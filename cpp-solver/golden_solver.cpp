#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <limits>
#include <queue>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

namespace {
constexpr int WALL = -2;
struct Env {
  int w=0,h=0,start=-1,exit=-1,maxDelay=0; bool tutorial=false,v11=false; int plateRule=1; // 0: none, 1: all, 2: any
  int goldPlate=-1,echoPlate=-1,ironPlate=-1;
  std::vector<std::string> map;
  std::vector<int> keys, plates, delays;
  std::vector<bool> enabled;
  std::array<int,256> portal{};
  std::vector<bool> deadCorner;
  Env(){ portal.fill(-1); }
  bool in(int p) const { return p>=0 && p<w*h; }
  int x(int p) const { return p%w; }
  int y(int p) const { return p/w; }
  char cell(int p) const { return in(p)?map[y(p)][x(p)]:'1'; }
  bool wall(int p) const { return !in(p)||cell(p)=='1'; }
  int step(int p,int d) const { int nx=x(p)+(d==3)-(d==2), ny=y(p)+(d==1)-(d==0); return nx<0||ny<0||nx>=w||ny>=h?WALL:ny*w+nx; }
  int warp(int p) const { unsigned char c=(unsigned char)cell(p); return portal[c]>=0?portal[c]:p; }
};
struct State { int p=-1,phase=0,g=0,first=-1; std::vector<int> boxes,echos; uint64_t keyMask=0; std::string hist; };
struct Item { State s; int score=0,heuristic=0; };
struct Cmp { bool operator()(Item const&a,Item const&b) const { return a.score>b.score || (a.score==b.score && a.heuristic>b.heuristic); } };

std::vector<std::string> split(const std::string&s,char sep){std::vector<std::string>o;std::string t;std::stringstream ss(s);while(std::getline(ss,t,sep))o.push_back(t);return o;}
std::vector<int> nums(const std::string&s){std::vector<int>o;if(s.empty()||s=="-")return o;for(auto&t:split(s,',')){try{o.push_back(std::stoi(t));}catch(...){o.push_back(-1);}}return o;}
int dirChar(char c){return c=='U'?0:c=='D'?1:c=='L'?2:c=='R'?3:-1;}
char charDir(int d){return "UDLR"[d];}

bool has(const std::vector<int>&v,int p,int ignore=-999){for(int q:v)if(q==p&&q!=ignore)return true;return false;}
bool keyCollected(const State&s,int i){return (s.keyMask>>i)&1ULL;}
int keyIndex(const Env&e,int p){for(int i=0;i<(int)e.keys.size();++i)if(e.keys[i]==p)return i;return -1;}
bool plateOn(const Env&e,const State&s,int plate){return s.p==plate||has(s.boxes,plate)||has(s.echos,plate);}
bool allPlates(const Env&e,const State&s){
  if(e.v11)return s.boxes.size()>=2&&s.echos.size()>=1&&s.boxes[0]==e.goldPlate&&s.echos[0]==e.echoPlate&&s.boxes[1]==e.ironPlate;
  for(int p:e.plates)if(!plateOn(e,s,p))return false;return true;}
bool platesReady(const Env&e,const State&s){
  if(e.plateRule==0)return true;
  if(e.plateRule==2){for(int p:e.plates)if(plateOn(e,s,p))return true;return false;}
  return allPlates(e,s);
}
bool win(const Env&e,const State&s){uint64_t want=e.keys.size()>=64?~0ULL:((1ULL<<e.keys.size())-1ULL);return s.p==e.exit && s.keyMask==want && platesReady(e,s);}

bool createsDeadBox(const Env&e,int p){
  if(std::find(e.plates.begin(),e.plates.end(),p)!=e.plates.end())return false;
  int u=e.step(p,0),d=e.step(p,1),l=e.step(p,2),r=e.step(p,3);
  return (e.wall(u)&&e.wall(l))||(e.wall(u)&&e.wall(r))||(e.wall(d)&&e.wall(l))||(e.wall(d)&&e.wall(r));
}

bool transition(const Env&e,const State&cur,int d,State&out){
  out=cur; int target=e.step(cur.p,d); if(e.wall(target))return false;
  int boxI=-1;for(int i=0;i<(int)out.boxes.size();++i)if(out.boxes[i]==target){boxI=i;break;}
  if(boxI>=0){
    int pushed=e.step(target,d); if(e.wall(pushed)||has(out.boxes,pushed)||has(out.echos,pushed))return false;
    int land=e.warp(pushed); if(e.wall(land)||has(out.boxes,land,target)||has(out.echos,land)||land==cur.p){ if(e.tutorial && land!=pushed) land=pushed; else return false; }
    if(createsDeadBox(e,land))return false;
    out.boxes[boxI]=land;
    // 推箱子时，芙停在箱子原格，不随箱子进入传送门。
    out.p=target;
  } else {
    int end=e.warp(target);
    if(e.wall(end)||has(out.boxes,end)||has(out.echos,end)){ if(e.tutorial && end!=target) end=target; else return false; }
    out.p=end;
  }
  // 芙不能与替罪芙重合。
  if(has(out.echos,out.p))return false;
  int ki=keyIndex(e,out.p); if(ki>=0)out.keyMask|=(1ULL<<ki);
  out.g=cur.g+1; if(out.first<0)out.first=d;
  out.hist.push_back(charDir(d)); if((int)out.hist.size()>e.maxDelay)out.hist.erase(out.hist.begin());
  int before=cur.phase, after=before<e.maxDelay?before+1:e.maxDelay+1;
  out.phase=std::min(e.maxDelay,after);
  for(int i=0;i<(int)e.delays.size();++i){
    if(i>=(int)e.enabled.size()||!e.enabled[i])continue;
    int delay=e.delays[i];
    if(after==delay){out.echos[i]=e.start;continue;}
    if(after<=delay||out.echos[i]<0)continue;
    int pos=out.echos[i]; int hi=(int)out.hist.size()-delay-1;
    if(hi<0||hi>=(int)out.hist.size())continue;
    int ed=dirChar(out.hist[hi]); int et=e.step(pos,ed);
    if(e.wall(et)||has(out.boxes,et))continue; // 撞墙或箱子：替罪芙停留一回合
    int end=e.warp(et);
    // 替罪芙的传送出口被芙或箱子占用时停留；替罪芙之间可重叠。
    if(e.wall(end)||has(out.boxes,end)||end==out.p) {
      if(end==out.p && et==end) return false; // 非传送门直接撞到芙：失败
      continue;
    }
    out.echos[i]=end;
    if(end==out.p)return false;
  }
  if(!e.v11)std::sort(out.boxes.begin(),out.boxes.end());
  return true;
}

int heuristic(const Env&e,const State&s){
  int h=0, remaining=0; int nearestKey=9999;
  for(int i=0;i<(int)e.keys.size();++i)if(!keyCollected(s,i)){++remaining;nearestKey=std::min(nearestKey,std::abs(e.x(s.p)-e.x(e.keys[i]))+std::abs(e.y(s.p)-e.y(e.keys[i])));}
  if(remaining)h+=nearestKey+2*(remaining-1);
  for(int plate:e.plates)if(!plateOn(e,s,plate)){
    int best=std::abs(e.x(s.p)-e.x(plate))+std::abs(e.y(s.p)-e.y(plate));
    for(int b:s.boxes)best=std::min(best,std::abs(e.x(b)-e.x(plate))+std::abs(e.y(b)-e.y(plate)));
    for(int q:s.echos)if(q>=0)best=std::min(best,std::abs(e.x(q)-e.x(plate))+std::abs(e.y(q)-e.y(plate)));
    h+=best+1;
  }
  uint64_t want=e.keys.size()>=64?~0ULL:((1ULL<<e.keys.size())-1ULL);
  if(s.keyMask==want&&platesReady(e,s))h+=std::abs(e.x(s.p)-e.x(e.exit))+std::abs(e.y(s.p)-e.y(e.exit));
  return h;
}
int progress(const Env&e,const State&s){int v=0;for(int i=0;i<(int)e.keys.size();++i)if(keyCollected(s,i))v+=1000;if(e.v11){if(s.boxes.size()>=2&&s.boxes[0]==e.goldPlate)v+=550;if(s.echos.size()>=1&&s.echos[0]==e.echoPlate)v+=550;if(s.boxes.size()>=2&&s.boxes[1]==e.ironPlate)v+=550;return v;}for(int p:e.plates)if(plateOn(e,s,p))v+=550;return v;}
std::string encode(const State&s){std::string k=std::to_string(s.p)+":"+std::to_string(s.phase)+":"+std::to_string(s.keyMask)+":"+s.hist+":";for(int b:s.boxes)k+=std::to_string(b)+",";k+=':';for(int q:s.echos)k+=std::to_string(q)+",";return k;}

bool parse(const char*raw,Env&e,State&s){
  if(!raw)return false;auto f=split(raw,'|');if(f.size()!=9&&f.size()!=10)return false;e.tutorial=f.size()==10&&f[9].rfind("tutorial",0)==0;if(e.tutorial){e.plateRule=f[9]=="tutorial-any"?2:(f[9]=="tutorial-none"?0:1);}else if(f.size()==10&&f[9].rfind("v11,",0)==0){auto spec=nums(f[9].substr(4));if(spec.size()!=3)return false;e.v11=true;e.goldPlate=spec[0];e.echoPlate=spec[1];e.ironPlate=spec[2];e.plates.insert(e.plates.end(),spec.begin(),spec.end());}
  e.map=split(f[0],'~');if(e.map.empty())return false;e.h=(int)e.map.size();e.w=(int)e.map[0].size();for(auto&r:e.map)if((int)r.size()!=e.w)return false;
  for(int y=0;y<e.h;++y)for(int x=0;x<e.w;++x){char c=e.map[y][x];int p=y*e.w+x;if(c=='S')e.start=p;if(c=='E')e.exit=p;if(c=='K')e.keys.push_back(p);if(c=='P')e.plates.push_back(p);}
  auto ds=nums(f[1]), es=nums(f[2]);e.delays=ds;e.enabled.assign(ds.size(),true);for(int i=0;i<(int)ds.size();++i){if(i<(int)es.size())e.enabled[i]=es[i]!=0;if(e.enabled[i])e.maxDelay=std::max(e.maxDelay,ds[i]);}
  for(int c=0;c<256;++c){char ch=(char)c;if(!std::isalpha((unsigned char)ch)||ch=='S'||ch=='E'||ch=='K'||ch=='B'||ch=='P')continue;char other=std::islower((unsigned char)ch)?std::toupper((unsigned char)ch):std::tolower((unsigned char)ch);int a=-1,b=-1;for(int y=0;y<e.h;++y)for(int x=0;x<e.w;++x){char v=e.map[y][x];if(v==ch)a=y*e.w+x;if(v==other)b=y*e.w+x;}if(a>=0&&b>=0)e.portal[(unsigned char)ch]=b;}
  try{s.p=std::stoi(f[3]);s.keyMask=std::stoull(f[5]);s.phase=std::min(std::stoi(f[8]),e.maxDelay);}catch(...){return false;}s.boxes=nums(f[4]);s.echos=nums(f[6]);s.hist=f[7];if((int)s.echos.size()<e.delays.size())s.echos.resize(e.delays.size(),-1);if((int)s.hist.size()>e.maxDelay)s.hist=s.hist.substr(s.hist.size()-e.maxDelay);s.g=0;s.first=-1;if(!e.v11)std::sort(s.boxes.begin(),s.boxes.end());return e.start>=0&&e.exit>=0;
}

std::string solve(const char*raw){
  Env e;State start;if(!parse(raw,e,start))return "ERROR|请求格式无效";if(win(e,start))return "DONE|";
  auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(400);
  std::priority_queue<Item,std::vector<Item>,Cmp> open;std::unordered_map<std::string,int> best;int h=heuristic(e,start);open.push({start,h,h});best[encode(start)]=0;
  State candidate;bool gotCandidate=false;int bestProgress=-1,bestH=std::numeric_limits<int>::max(),expanded=0;
  while(!open.empty()){
    if((expanded&255)==0 && std::chrono::steady_clock::now()>=deadline)break;
    Item it=open.top();open.pop();auto key=encode(it.s);auto found=best.find(key);if(found==best.end()||found->second!=it.s.g)continue;
    ++expanded;
    int pg=progress(e,it.s), hh=it.heuristic;
    if(it.s.first>=0 && (pg>bestProgress||(pg==bestProgress&&hh<bestH))){candidate=it.s;gotCandidate=true;bestProgress=pg;bestH=hh;}
    if(win(e,it.s))return std::string("FOUND|")+charDir(it.s.first)+"|"+std::to_string(expanded);
    for(int d=0;d<4;++d){State n;if(!transition(e,it.s,d,n))continue;auto nk=encode(n);auto old=best.find(nk);if(old!=best.end()&&old->second<=n.g)continue;best[nk]=n.g;int nh=heuristic(e,n);int score=n.g+(nh*14)/10-progress(e,n)/80;open.push({std::move(n),score,nh});}
  }
  if(gotCandidate)return std::string("BEST|")+charDir(candidate.first)+"|"+std::to_string(expanded);
  return "NONE|"+std::to_string(expanded);
}
}
extern "C" EMSCRIPTEN_KEEPALIVE const char* golden_hint(const char* request){static std::string result;result=solve(request);return result.c_str();}
