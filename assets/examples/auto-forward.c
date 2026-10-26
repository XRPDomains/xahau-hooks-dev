#include "hookapi.h"

/* Teaching example: requires HooksUpdate2 (prepare), one outstanding transfer.
 * Record: version, status (1 pending/2 success/3 failed), child id[32],
 * drops[8] big endian, destination[20], attempts, parent id[32] = 95 bytes.
 * Callback is weak: a failed state write cannot undo the executed child.
 */
static const uint8_t KEY[32]={'A','F','W','D'};

int64_t hook(uint32_t context)
{
    (void)context; _g(1,1);
    int64_t type=otxn_type();
    if (type!=ttPAYMENT && type!=ttINVOKE) return accept(0,0,0);
    uint8_t owner[20], sender[20], record[95], target[20];
    if (hook_account((uint32_t)owner,20)!=20 ||
        otxn_field((uint32_t)sender,20,sfAccount)!=20) return rollback(0,0,1001);
    uint32_t self=1;
    for(uint32_t i=0; _g(2,21),i<20; ++i) if(owner[i]!=sender[i]) self=0;
    int64_t old=state((uint32_t)record,95,(uint32_t)KEY,32);
    if (old!=DOESNT_EXIST && old!=95) return rollback(0,0,1002);
    if(old==95 && (record[0]!=1 || record[1]<1 || record[1]>3)) return rollback(0,0,1002);
    if(type==ttINVOKE) {
        if(!self) return rollback(0,0,1003);
        if(otxn_field((uint32_t)target,20,sfDestination)!=DOESNT_EXIST) return rollback(0,0,1003);
        uint8_t op[5];
        if(otxn_param((uint32_t)op,5,(uint32_t)"op",2)!=5 ||
           op[0]!='r'||op[1]!='e'||op[2]!='t'||op[3]!='r'||op[4]!='y') return rollback(0,0,1004);
        if(old!=95 || record[1]!=3 || record[62]>=3) return rollback(0,0,1005);
    } else {
        if(self) return accept(0,0,0); /* Outgoing child must never recurse. */
        int64_t generation=otxn_generation();
        if(generation<0) return rollback(0,0,1006);
        if(generation!=0) return accept(0,0,0);
        if(otxn_field((uint32_t)target,20,sfDestination)!=20) return rollback(0,0,1007);
        for(uint32_t i=0; _g(3,21),i<20; ++i)
            if(target[i]!=owner[i]) return accept(0,0,0);
        uint8_t flags[4];
        int64_t fn=otxn_field((uint32_t)flags,4,sfFlags);
        if(fn!=DOESNT_EXIST && fn!=4) return rollback(0,0,1008);
        if(fn==4 && ((flags[0]&0x7F)||flags[1]||flags[2]||flags[3])) return rollback(0,0,1008);
        uint8_t amount[8];
        if(otxn_field((uint32_t)amount,8,sfAmount)!=8 || (amount[0]&0xC0)!=0x40) return rollback(0,0,1009);
        uint64_t drops=amount[0]&0x3FU;
        for(uint32_t i=1; _g(4,8),i<8; ++i) drops=(drops<<8)|amount[i];
        drops/=20U;
        if(drops==0) return accept(0,0,0);
        if(old==95 && record[1]!=2) return rollback(0,0,1010);
        if(hook_param((uint32_t)(record+42),20,(uint32_t)"savings",7)!=20) return rollback(0,0,1011);
        uint32_t same=1;
        for(uint32_t i=0; _g(5,21),i<20; ++i) if(record[42+i]!=owner[i]) same=0;
        if(same) return rollback(0,0,1012);
        for(uint32_t i=0; _g(6,9),i<8; ++i) {record[41-i]=(uint8_t)drops; drops>>=8;}
        record[0]=1; record[62]=0;
        if(otxn_id((uint32_t)(record+63),32,0)!=32) return rollback(0,0,1013);
    }
    /* Partial STObject: Payment, native Amount, Destination. prepare fills emission fields. */
    uint8_t partial[34], prepared[512];
    partial[0]=0x12; partial[1]=0; partial[2]=0; partial[3]=0x61;
    for(uint32_t i=0; _g(7,9),i<8; ++i) partial[4+i]=record[34+i];
    partial[4]|=0x40; partial[12]=0x83; partial[13]=20;
    for(uint32_t i=0; _g(8,21),i<20; ++i) partial[14+i]=record[42+i];
    if(etxn_reserve(1)!=1) return rollback(0,0,1014);
    int64_t n=prepare((uint32_t)prepared,512,(uint32_t)partial,34);
    if(n<1 || n>512) return rollback(0,0,1015);
    if(emit((uint32_t)(record+2),32,(uint32_t)prepared,(uint32_t)n)!=32) return rollback(0,0,1016);
    record[1]=1; ++record[62];
    if(state_set((uint32_t)record,95,(uint32_t)KEY,32)!=95) return rollback(0,0,1017);
    return accept(0,0,0);
}

int64_t cbak(uint32_t reason)
{
    _g(100,1);
    uint8_t record[95], id[32];
    if(state((uint32_t)record,95,(uint32_t)KEY,32)!=95 || record[0]!=1 || record[1]!=1)
        return accept(0,0,0);
    if(otxn_id((uint32_t)id,32,0)!=32) return accept(0,0,2001);
    for(uint32_t i=0; _g(101,33),i<32; ++i)
        if(id[i]!=record[2+i]) return accept(0,0,2002);
    if(reason==1) record[1]=3;
    else if(reason==0) {
        uint8_t result[1];
        if(meta_slot(10)!=10 || slot_subfield(10,sfTransactionResult,11)!=11 ||
           slot((uint32_t)result,1,11)!=1) return accept(0,0,2003);
        record[1]=result[0]==0?2:3;
    } else return accept(0,0,2004);
    if(state_set((uint32_t)record,95,(uint32_t)KEY,32)!=95) return accept(0,0,2005);
    return accept(0,0,0);
}
