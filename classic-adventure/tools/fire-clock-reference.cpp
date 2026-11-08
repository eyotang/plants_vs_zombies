#include <cstdio>
#include <initializer_list>
// Reanimator.h:double SECONDS_PER_UPDATE=0.01f; float mAnimTime/rate;
// Update advances by frameCount25; GetFrameTime samples frameCount-1.
int main(){bool first=true;std::printf("[");for(float rate:{50.f,65.f,80.f}){float time=0;const double dt=0.01f;for(int n=1;n<=100000;n++){time+=dt*rate/25;while(time>=1)time-=1;if(n==1||n==17||n==100||n==1000||n==10000||n==100000){std::printf("%s{\"rate\":%.9g,\"tick\":%d,\"time\":%.17g}",first?"":",",rate,n,double(time));first=false;}}}std::printf("]\n");}
