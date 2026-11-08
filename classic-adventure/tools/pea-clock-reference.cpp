// Standalone arithmetic check for pinned Reanimator.h/.cpp clock expressions.
// It is not the original game executable or a visual acceptance oracle.
#include <cstdio>
#include <initializer_list>
int main() {
 constexpr const double seconds = 0.01f;
 std::printf("{\"body\":[");
 bool comma=false;
 for(float rate:{15.0f,17.5f,20.0f}) {
  float time=0;
  for(int tick=1;tick<=100000;tick++) {
   time+=seconds*rate/25;
   while(time>=1)time-=1;
   if(tick==1||tick==34||tick==35||tick==100||tick==150||tick==5000||tick==100000) {
    std::printf("%s{\"rate\":%.9g,\"tick\":%d,\"time\":%.17g}",comma?",":"",rate,tick,(double)time);comma=true;
   }
  }
 }
 std::printf("],\"oneShot\":[");comma=false;
 for(int kind=0;kind<4;kind++) {
  const int frames=kind==2?39:kind==3?13:25;
  const float rate=kind==0||kind==3?35.0f:kind==1?45.0f:38.0f;
  float time=0;int loops=0;
  for(int tick=1;tick<=110;tick++) {
   time+=seconds*rate/frames;
   if(time>=1){time=1;loops=1;}
   if(tick==1||tick==25||tick==34||tick==55||tick==56||tick==71||tick==72||tick==102||tick==103||tick==110) {
    std::printf("%s{\"frames\":%d,\"rate\":%.9g,\"tick\":%d,\"time\":%.17g,\"loops\":%d}",comma?",":"",frames,rate,tick,(double)time,loops);comma=true;
   }
  }
 }
 std::printf("]}\n");
}
