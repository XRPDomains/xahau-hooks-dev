#include "hookapi.h"
/* Outgoing direct Payments: allow XAH expenses, limit own TST issuance to 100/tx.
 * This is not a supply cap or a policy on DEX/Remit/third-party transfers. */
int64_t hook(uint32_t context)
{
    (void)context; _g(1,1);
    int64_t type=otxn_type();
    if(type<0) return rollback((uint32_t)"type read",9,2101);
    if(type!=ttPAYMENT) return accept((uint32_t)"pass",4,0);
    uint8_t account[20],sender[20];
    if(hook_account((uint32_t)account,20)!=20 || otxn_field((uint32_t)sender,20,sfAccount)!=20)
        return rollback((uint32_t)"account read",12,2102);
    for(uint32_t i=0;_g(2,21),i<20;++i)
        if(account[i]!=sender[i]) return accept((uint32_t)"incoming pass",13,0);
    uint8_t amount[48],flags[4];
    int64_t n=otxn_field((uint32_t)amount,sizeof(amount),sfAmount);
    if(n==8 && !(amount[0]&0x80U)) return accept((uint32_t)"native pass",11,0);
    if(n!=48 || !(amount[0]&0x80U)) return rollback((uint32_t)"IOU amount",10,2103);
    /* STAmount: 8 value bytes, 20 currency bytes, 20 issuer bytes. */
    const uint8_t currency[20]={0,0,0,0,0,0,0,0,0,0,0,0,'T','S','T',0,0,0,0,0};
    for(uint32_t i=0;_g(3,21),i<20;++i)
        if(amount[8+i]!=currency[i] || amount[28+i]!=account[i])
            return rollback((uint32_t)"wrong asset",11,2104);
    int64_t f=otxn_field((uint32_t)flags,4,sfFlags);
    if(f!=DOESNT_EXIST){
        if(f!=4) return rollback((uint32_t)"flags read",10,2105);
        if((flags[0]&0x7FU)||flags[1]||flags[2]||flags[3])
            return rollback((uint32_t)"payment flags",13,2106);
    }
    int64_t value=float_sto_set((uint32_t)amount,8);
    int64_t limit=float_set(0,100);
    if(value<0 || limit<0) return rollback((uint32_t)"XFL read",8,2107);
    if(float_compare(value,0,COMPARE_GREATER)!=1 ||
       float_compare(value,limit,COMPARE_LESS|COMPARE_EQUAL)!=1)
        return rollback((uint32_t)"issue limit",11,2108);
    return accept((uint32_t)"issue policy ok",15,0);
}
