#include "hookapi.h"

/* Matches assets/contact-book.interface.json. Owner-only, UTF-8 bytes opaque to C. */
int64_t hook(uint32_t context)
{
    (void)context;
    _g(1, 1);
    if (otxn_type() != ttINVOKE) return accept(0, 0, 0);
    uint8_t owner[20], sender[20];
    if (hook_account((uint32_t)owner, 20) != 20 ||
        otxn_field((uint32_t)sender, 20, sfAccount) != 20)
        return rollback(0, 0, 1001);
    for (uint32_t i=0; _g(2, 21), i<20; ++i)
        if (owner[i] != sender[i]) return rollback(0, 0, 1002);
    uint8_t op[1], name[28], record[21]={1}, key[32]={'C','T','C','T'};
    if (otxn_param((uint32_t)op, 1, (uint32_t)"op", 2) != 1 || op[0] != 1)
        return rollback(0, 0, 1003);
    int64_t n=otxn_param((uint32_t)name, 28, (uint32_t)"name", 4);
    if (n<1 || n>28) return rollback(0, 0, 1004);
    for (uint32_t i=0; _g(3, 29), i<(uint32_t)n; ++i) {
        if (name[i]==0) return rollback(0, 0, 1004);
        key[4+i]=name[i];
    }
    if (otxn_param((uint32_t)(record+1), 20, (uint32_t)"addr", 4) != 20)
        return rollback(0, 0, 1005);
    if (state_set((uint32_t)record, 21, (uint32_t)key, 32) != 21)
        return rollback(0, 0, 1006);
    return accept(0, 0, 0);
}
