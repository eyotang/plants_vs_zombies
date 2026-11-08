// Independent source arithmetic oracle: Zombie::UpdateAnimSpeed,
// Reanimation::GetFrameTime/GetTrackVelocity and the final float position.
#include <cmath>
#include <cstdio>
#include <initializer_list>
int main(){float xs[]={-9.8f,-8.5f,-7.3f,-6.0f,-4.7f,-3.4f,-2.1f,-0.9f,0.3f,1.6f,2.8f,4.1f,5.4f,6.7f,8.0f,9.2f,10.5f,10.6f,10.7f,10.7f,10.8f,10.8f,10.9f,11.0f,12.8f,14.5f,16.3f,18.1f,19.9f,21.6f,23.4f,25.2f,27.0f,28.8f,30.5f,32.3f,34.0f,35.9f,37.6f,39.4f,39.5f,39.5f,39.6f,39.8f,39.9f,39.9f,40.0f};const int count=47;const double dt=.01f;bool comma=false;printf("[");for(float rawStart:{600.f,770.f})for(int mini=0;mini<2;mini++)for(int cold=0;cold<2;cold++){float time=0,x=rawStart,scale=mini?.5f:1.f;float rate=.3f*(count/(xs[46]-xs[0]))*47.f/scale;if(cold)rate*=.5f;for(int n=1;n<=100000;n++){float position=91+time*46;int i=(int)floor(position)-91;i=i<46?i:46;float velocity=(xs[i<46?i+1:i]-xs[i])*dt*rate;x-=velocity*scale;time+=dt*rate/count;while(time>=1)time-=1;if(n==1||n==30||n==100||n==1000||n==10000||n==100000){printf("%s{\"rawStart\":%.0f,\"mini\":%d,\"cold\":%d,\"tick\":%d,\"time\":%.17g,\"rawX\":%.17g}",comma?",":"",rawStart,mini,cold,n,time,x);comma=true;}}}printf("]\n");}
