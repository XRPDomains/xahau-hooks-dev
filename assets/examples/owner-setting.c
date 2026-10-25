#include "hookapi.h"

/* Teaching source. Target headers, guard checker and node tests are required. */
int64_t hook(uint32_t context)
{
    (void)context;
    _g(1, 1);
    if (otxn_type() != ttINVOKE)
        return accept((uint32_t)"pass", 4, 0);

    uint8_t account[20], sender[20];
    if (hook_account((uint32_t)account, 20) != 20 ||
        otxn_field((uint32_t)sender, 20, sfAccount) != 20)
        return rollback((uint32_t)"account read", 12, 1001);

    /* Bounded comparison: one invocation, 21 guard visits at most. */
    for (uint32_t i = 0; _g(2, 21), i < 20; ++i)
        if (sender[i] != account[i])
            return rollback((uint32_t)"owner only", 10, 1002);

    uint8_t record[9] = {1};
    const uint8_t name[] = "setting";
    if (otxn_param((uint32_t)(record + 1), 8,
                   (uint32_t)name, sizeof(name) - 1U) != 8)
        return rollback((uint32_t)"setting length", 14, 1003);

    uint8_t key[32] = {0};
    key[31] = 1;
    if (state_set((uint32_t)record, sizeof(record),
                  (uint32_t)key, sizeof(key)) != sizeof(record))
        return rollback((uint32_t)"state write", 11, 1004);

    return accept((uint32_t)"setting saved", 13, 0);
}
