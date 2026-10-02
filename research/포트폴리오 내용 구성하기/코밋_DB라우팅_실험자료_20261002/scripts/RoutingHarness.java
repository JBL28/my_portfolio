import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.sql.DataSource;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

public class RoutingHarness {
  static final Path ROOT=Path.of("/exp");
  static final String SCHEMA="routing_exp_20261002";
  static final List<HikariDataSource> POOLS=new ArrayList<>();
  static final List<Map<String,Object>> SAMPLES=Collections.synchronizedList(new ArrayList<>());
  static final AtomicLong VERSION=new AtomicLong(100);
  static Properties config=new Properties();
  static boolean ownSchema=false;
  static Client[] clients=new Client[2];
  record Info(String db,int pid,boolean replica,long version) {}
  static class Client {
    HikariDataSource write,read; JdbcTemplate jdbc; TransactionTemplate rw,ro;
    Client(String prefix,String label) throws Exception {
      DataSourceProperties props=new DataSourceProperties();
      props.setUrl(config.getProperty(prefix+".writeUrl"));
      props.setUsername(config.getProperty(prefix+".username"));
      props.setPassword(config.getProperty(prefix+".password"));
      props.setDriverClassName("org.postgresql.Driver");
      ObjectProvider<JdbcConnectionDetails> provider=new StaticListableBeanFactory().getBeanProvider(JdbcConnectionDetails.class);
      Class<?> c=Class.forName("com.a501.service.config.DataSourceRoutingConfig");
      Object instance=c.getConstructor().newInstance();
      Method wm=c.getDeclaredMethod("writeDataSource",DataSourceProperties.class,ObjectProvider.class); wm.setAccessible(true);
      Method rm=c.getDeclaredMethod("readDataSource",DataSourceProperties.class,ObjectProvider.class,String.class); rm.setAccessible(true);
      write=(HikariDataSource)wm.invoke(instance,props,provider);
      read=(HikariDataSource)rm.invoke(instance,props,provider,config.getProperty(prefix+".readUrl"));
      write.setPoolName(label+"-write");read.setPoolName(label+"-read");
      write.addDataSourceProperty("ApplicationName","routing-experiment-"+label+"-write");
      read.addDataSourceProperty("ApplicationName","routing-experiment-"+label+"-read");
      write.addDataSourceProperty("socketTimeout","8");read.addDataSourceProperty("socketTimeout","8");
      POOLS.add(write);POOLS.add(read);
      Method dm=c.getDeclaredMethod("dataSource",DataSource.class,DataSource.class);dm.setAccessible(true);
      DataSource ds=(DataSource)dm.invoke(instance,write,read);
      jdbc=new JdbcTemplate(ds);
      var tm=new DataSourceTransactionManager(ds);
      rw=new TransactionTemplate(tm);rw.setTimeout(8);
      ro=new TransactionTemplate(tm);ro.setReadOnly(true);ro.setTimeout(8);
    }
    Info info(int id) {
      return jdbc.queryForObject("SELECT inet_server_addr()::text, pg_backend_pid(), pg_is_in_recovery(), version FROM "+SCHEMA+".markers WHERE id=?",(rs,n)->new Info(rs.getString(1),rs.getInt(2),rs.getBoolean(3),rs.getLong(4)),id);
    }
    Info read(int id){return ro.execute(s->info(id));}
    Info write(int id,long version,String mode){return rw.execute(s->{
      if(mode!=null)jdbc.execute("SET LOCAL synchronous_commit = '"+mode+"'");
      jdbc.update("UPDATE "+SCHEMA+".markers SET version=? WHERE id=?",version,id);
      return info(id);
    });}
  }
  static Map<String,Object> infoMap(Info i){return new LinkedHashMap<>(Map.of("db",i.db,"pid",i.pid,"replica",i.replica,"version",i.version));}
  static void output(Map<String,Object> value){System.out.println(json(value));System.out.flush();}
  static void record(String phase,int client,String type,long expected,long start,Info info,String error){
    Map<String,Object> x=new LinkedHashMap<>();x.put("phase",phase);x.put("client",client);x.put("type",type);x.put("expected",expected);x.put("ms",(System.nanoTime()-start)/1e6);
    if(info!=null)x.putAll(infoMap(info));x.put("error",error);SAMPLES.add(x);
  }
  static void save(String name)throws IOException{Files.writeString(ROOT.resolve(name),json(SAMPLES));}
  static double percentile(List<Double> x,double p){x.sort(Double::compare);double pos=(x.size()-1)*p;int lo=(int)pos;return x.get(lo)+(x.get(Math.min(lo+1,x.size()-1))-x.get(lo))*(pos-lo);}
  static Map<String,Object> summarize(String phase){
    List<Map<String,Object>> samples; synchronized(SAMPLES){samples=SAMPLES.stream().filter(x->phase.equals(x.get("phase"))).toList();}
    Map<String,Object> out=new LinkedHashMap<>();out.put("phase",phase);out.put("count",samples.size());
    out.put("errors",samples.stream().filter(x->x.get("error")!=null).count());
    out.put("routing_mismatches",samples.stream().filter(x->x.get("error")==null && !Objects.equals(x.get("replica"),"read".equals(x.get("type")))).count());
    Map<String,Integer> routes=new TreeMap<>();
    for(var x:samples)if(x.get("db")!=null)routes.merge(x.get("type")+":"+x.get("db"),1,Integer::sum);
    out.put("routes",routes);
    var ms=new ArrayList<Double>();for(var x:samples)ms.add((Double)x.get("ms"));
    if(!ms.isEmpty()){out.put("p50_ms",percentile(ms,.5));out.put("p95_ms",percentile(ms,.95));out.put("p99_ms",percentile(ms,.99));}
    return out;
  }
  static void mixed(String phase,int rate,int seconds)throws Exception{
    var pool=Executors.newFixedThreadPool(24);List<Future<?>> tasks=new ArrayList<>();long begin=System.nanoTime();
    for(int i=0;i<rate*seconds;i++){
      long remain=begin+(long)(i*1e9/rate)-System.nanoTime();if(remain>0)TimeUnit.NANOSECONDS.sleep(remain);
      int n=i;tasks.add(pool.submit(()->{
        int client=(n/10)%2,id=1+n%(phase.equals("consistency-background")?63:64);boolean read=n%10!=0;long start=System.nanoTime();
        try{Info info=read?clients[client].read(id):clients[client].write(id,VERSION.incrementAndGet(),null);record(phase,client,read?"read":"write",0,start,info,null);}
        catch(Exception e){record(phase,client,read?"read":"write",0,start,null,e.getClass().getSimpleName());}
      }));
    }
    for(var task:tasks)task.get();pool.shutdown();output(summarize(phase));
  }
  static Map<String,Object> consistency(String phase,int count)throws Exception{
    int stale=0;List<Double> writeMs=new ArrayList<>(),readMs=new ArrayList<>();Map<String,Integer> routes=new TreeMap<>();
    for(int i=0;i<count;i++){
      Client c=clients[i%2];long expected=VERSION.incrementAndGet();long start=System.nanoTime();Info w=c.write(64,expected,null);writeMs.add((System.nanoTime()-start)/1e6);
      start=System.nanoTime();Info r=c.read(64);readMs.add((System.nanoTime()-start)/1e6);if(r.version!=expected)stale++;
      routes.merge(r.db,1,Integer::sum);record(phase,i%2,"read",expected,start,r,null);
    }
    var out=new LinkedHashMap<String,Object>();out.put("phase",phase);out.put("pairs",count);out.put("stale",stale);out.put("routes",routes);out.put("write_p50_ms",percentile(writeMs,.5));out.put("write_p95_ms",percentile(writeMs,.95));out.put("read_p95_ms",percentile(readMs,.95));output(out);return out;
  }
  static void initialize(){
    try(Connection c=clients[0].write.getConnection();Statement s=c.createStatement()){
      s.execute("CREATE SCHEMA "+SCHEMA);
      ownSchema=true;
      s.execute("CREATE TABLE "+SCHEMA+".markers(id integer PRIMARY KEY,version bigint NOT NULL)");
      s.execute("INSERT INTO "+SCHEMA+".markers SELECT i,0 FROM generate_series(1,64) i");
    }catch(SQLException e){throw new RuntimeException(e);}
  }
  static void live()throws Exception{
    initialize();var results=new ArrayList<Map<String,Object>>();
    // Barrier warms all ten read-pool connections for both clients.
    var warmPool=Executors.newFixedThreadPool(20);var barrier=new CyclicBarrier(20);List<Future<?>> futures=new ArrayList<>();
    for(int i=0;i<20;i++){Client c=clients[i%2];futures.add(warmPool.submit(()->c.ro.execute(s->{c.info(1);try{barrier.await(10,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException(e);}return null;})));}
    for(var f:futures)f.get();warmPool.shutdown();
    mixed("jdbc-warmup",20,30);
    results.add(consistency("consistency-idle",1000));
    for(int r=1;r<=3;r++){
      mixed("jdbc-mixed-"+r,100,60);results.add(summarize("jdbc-mixed-"+r));
    }
    // Background mixed traffic uses IDs 1..63 so it cannot change the probe marker.
    var background=Executors.newSingleThreadExecutor();
    Future<?> load=background.submit(()->{try{mixed("consistency-background",100,60);}catch(Exception e){throw new RuntimeException(e);}});
    Thread.sleep(3000);results.add(consistency("consistency-loaded",1000));load.get();background.shutdown();
    // Same datasource must be used for an existing transaction to be joined.
    int primaryNested=0;for(int i=0;i<100;i++){Client c=clients[i%2];Info info=c.rw.execute(s->c.ro.execute(t->c.info(1)));if(!info.replica)primaryNested++;}
    results.add(Map.of("phase","nested-read-in-write","cases",100,"primary",primaryNested));
    output(results.get(results.size()-1));Files.writeString(ROOT.resolve("jdbc-summary.json"),json(results));save("jdbc-samples.json");
  }
  static void lab()throws Exception{
    initialize();mixed("lab-warmup",20,5);output(Map.of("event","READY"));
    try(var input=new BufferedReader(new InputStreamReader(System.in))){
      String line;while((line=input.readLine())!=null){
        String[] parts=line.split("\\t");String command=parts[0];
        if(command.equals("QUIT"))break;
        if(command.equals("BASE")){consistency("lab-baseline",Integer.parseInt(parts[1]));output(Map.of("event","DONE"));continue;}
        if(command.equals("DELAY")){
          String mode=parts[1];long expected=Long.parseLong(parts[2]);long before=clients[0].read(64).version;
          output(Map.of("event","WRITE_START","mode",mode));long begin=System.nanoTime();Info w=clients[0].write(64,expected,mode);double writeMs=(System.nanoTime()-begin)/1e6;
          int stale=0;Map<String,Integer> routes=new TreeMap<>();
          for(int i=0;i<20;i++){Info info=clients[i%2].read(64);if(info.version!=expected)stale++;routes.merge(info.db,1,Integer::sum);}
          output(Map.of("event","RESULT","mode",mode,"before",before,"expected",expected,"write_ms",writeMs,"reads",20,"stale",stale,"routes",routes,"write_primary",!w.replica));
        }
        if(command.equals("VERIFY")){long expected=Long.parseLong(parts[1]);int stale=0;for(int i=0;i<20;i++)if(clients[i%2].read(64).version!=expected)stale++;output(Map.of("event","VERIFIED","reads",20,"stale",stale));}
      }
    }
    save("lab-samples.json");
  }
  static String json(Object o){
    if(o==null)return "null";if(o instanceof Number || o instanceof Boolean)return o.toString();
    if(o instanceof Map<?,?> m){var parts=new ArrayList<String>();for(var e:m.entrySet())parts.add(json(e.getKey().toString())+":"+json(e.getValue()));return "{"+String.join(",",parts)+"}";}
    if(o instanceof Collection<?> xs){var parts=new ArrayList<String>();for(Object x:xs)parts.add(json(x));return "["+String.join(",",parts)+"]";}
    return "\""+o.toString().replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r")+"\"";
  }
  public static void main(String[] args)throws Exception{
    config.load(Files.newBufferedReader(ROOT.resolve("credentials.properties")));
    String prefix=args[0];for(int i=0;i<2;i++)clients[i]=new Client(prefix,prefix+i);
    try{if(prefix.equals("live"))live();else lab();}
    finally{
      if(ownSchema)try(Connection c=clients[0].write.getConnection();Statement s=c.createStatement()){s.execute("DROP SCHEMA "+SCHEMA+" CASCADE");}catch(Exception e){System.err.println("Cleanup error "+e.getClass().getSimpleName());}
      for(var pool:POOLS)pool.close();
    }
  }
}
