import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

public class PoolProbe {
  public static void main(String[] args)throws Exception {
    RoutingHarness.config.load(Files.newBufferedReader(RoutingHarness.ROOT.resolve("credentials.properties")));
    List<Map<String,Object>> results=new ArrayList<>();
    try {
      for(int cycle=1;cycle<=3;cycle++){
        RoutingHarness.clients=new RoutingHarness.Client[]{new RoutingHarness.Client("live","probe"+cycle+"a"),new RoutingHarness.Client("live","probe"+cycle+"b")};
        if(cycle==1)RoutingHarness.initialize();
        var pool=Executors.newFixedThreadPool(20);var barrier=new CyclicBarrier(20);var futures=new ArrayList<Future<Map<String,Object>>>();
        for(int i=0;i<20;i++){
          int c=i%2;
          futures.add(pool.submit(()->RoutingHarness.clients[c].ro.execute(s->{
            var info=RoutingHarness.clients[c].info(1);
            try{barrier.await(10,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException(e);}
            var x=RoutingHarness.infoMap(info);x.put("client",c);return x;
          })));
        }
        var connections=new ArrayList<Map<String,Object>>();for(var f:futures)connections.add(f.get());pool.shutdown();
        String phase="pool-recreation-"+cycle;RoutingHarness.mixed(phase,100,10);
        var r=new LinkedHashMap<String,Object>();r.put("cycle",cycle);r.put("connections",connections);r.put("summary",RoutingHarness.summarize(phase));results.add(r);
        for(var c:RoutingHarness.clients){c.read.close();c.write.close();}
      }
      Files.writeString(RoutingHarness.ROOT.resolve("pool-recreation-results.json"),RoutingHarness.json(results));RoutingHarness.save("pool-recreation-samples.json");
    } finally {
      if(RoutingHarness.ownSchema){var c=new RoutingHarness.Client("live","cleanup");try(var conn=c.write.getConnection();var s=conn.createStatement()){s.execute("DROP SCHEMA "+RoutingHarness.SCHEMA+" CASCADE");}c.read.close();c.write.close();}
      for(var p:RoutingHarness.POOLS)p.close();
    }
  }
}
