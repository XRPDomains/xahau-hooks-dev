#include "hookapi.h"
/* Initial issuer-side mint policy only. Does not govern later owner transfers/burns. */
int64_t hook(uint32_t context)
{
    (void)context; _g(1,1);
    int64_t type=otxn_type();
    if(type<0) return rollback((uint32_t)"type read",9,2001);
    if(type!=ttURITOKEN_MINT) return accept((uint32_t)"pass",4,0);
    uint8_t account[20],sender[20];
    if(hook_account((uint32_t)account,20)!=20 || otxn_field((uint32_t)sender,20,sfAccount)!=20)
        return rollback((uint32_t)"account read",12,2002);
    for(uint32_t i=0;_g(2,21),i<20;++i)
        if(account[i]!=sender[i]) return accept((uint32_t)"other minter",12,0);
    uint8_t uri[200],flags[4];
    int64_t n=otxn_field((uint32_t)uri,sizeof(uri),sfURI);
    if(n<8 || n>(int64_t)sizeof(uri)) return rollback((uint32_t)"URI length",10,2003);
    const uint8_t prefix[]="ipfs://";
    for(uint32_t i=0;_g(3,8),i<7;++i)
        if(uri[i]!=prefix[i]) return rollback((uint32_t)"URI prefix",10,2004);
    int64_t f=otxn_field((uint32_t)flags,4,sfFlags);
    if(f!=DOESNT_EXIST){
        if(f!=4) return rollback((uint32_t)"flags read",10,2005);
        /* Permit only the common canonical-signature bit; disallow issuer burnable. */
        if((flags[0]&0x7FU)||flags[1]||flags[2]||flags[3])
            return rollback((uint32_t)"mint flags",10,2006);
    }
    return accept((uint32_t)"mint policy ok",14,0);
}
