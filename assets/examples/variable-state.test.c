#include "variable-state.h"
#include <assert.h>
#include <stdio.h>
int main(void)
{
    uint8_t key[34], value[205], payload[200];
    memset(key, 0xA5, sizeof key); memset(value, 0xA5, sizeof value);
    const uint8_t *decoded=NULL;
    assert(xh_label_key(key+1,32,(const uint8_t *)"abc",3));
    assert(memcmp(key+1,"SLK1abc",7)==0);
    for(size_t i=8;i<33;++i) assert(key[i]==0);
    assert(key[0]==0xA5 && key[33]==0xA5);
    assert(!xh_label_key(key,31,(const uint8_t *)"abc",3));
    assert(!xh_label_key(key,32,(const uint8_t *)"A",1));
    assert(!xh_label_key(key,32,(const uint8_t *)"",0));
    for(size_t n=1;n<=200;++n){
        memset(payload,'x',n);
        assert(xh_text_encode(value+1,203,payload,n)==(int)n+3);
        assert(xh_text_decode(value+1,n+3,&decoded)==(int)n);
        assert(memcmp(decoded,payload,n)==0);
        assert(xh_text_decode(value+1,n+2,&decoded)==-1);
        assert(xh_text_decode(value+1,n+4,&decoded)==-1);
        assert(xh_text_encode(value+1,n+2,payload,n)==-1);
    }
    assert(value[0]==0xA5 && value[204]==0xA5);
    assert(xh_text_encode(value,sizeof value,payload,0)==-1);
    assert(xh_text_encode(value,sizeof value,payload,201)==-1);
    value[1]=2; assert(xh_text_decode(value+1,203,&decoded)==-1);
    /* Shared JS/C fixture: emit hex for cross-language comparison. */
    assert(xh_label_key(key,32,(const uint8_t *)"abc",3));
    for(size_t i=0;i<32;++i) printf("%02x",key[i]);
    putchar('\n');
    assert(xh_text_encode(value,sizeof value,(const uint8_t *)"https://example.com",19)==22);
    for(size_t i=0;i<22;++i) printf("%02x",value[i]);
    putchar('\n'); return 0;
}
