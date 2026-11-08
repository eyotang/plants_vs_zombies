// Independent float implementation of pinned Reanimator.cpp BlendTransform.
#include <cstdio>
int main(){
 float a[8]={12.34567f,-8.76543f,.98765f,1.23456f,15.25f,-12.5f,0,0.91234f};
 float b[8]={-34.56789f,53.45678f,1.76543f,.65432f,355.25f,140.5f,0,.23456f};
 std::printf("[\n");
 for(int left=0;left<=20;left++){
  float amount=left/20.f;
  std::printf("{\"left\":%d,\"current\":[",left);
  for(int k=0;k<8;k++)std::printf("%s%.17g",k?",":"",(double)a[k]);
  std::printf("],\"from\":[");for(int k=0;k<8;k++)std::printf("%s%.17g",k?",":"",(double)b[k]);
  std::printf("],\"result\":[");
  for(int k=0;k<8;k++){float prior=b[k];if((k==4||k==5)&&(prior>a[k]+180.f||prior<a[k]-180.f))prior=a[k];float result=k==6?a[k]:a[k]+amount*(prior-a[k]);std::printf("%s%.17g",k?",":"",(double)result);}
  std::printf(" ]}%s\n",left==20?"":",");
 }
 std::printf("]\n");
}
