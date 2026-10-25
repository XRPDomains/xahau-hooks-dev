#ifndef XH_SAFE_BYTES_H
#define XH_SAFE_BYTES_H
#include <stdint.h>
#include <stddef.h>
#include <limits.h>
#ifndef XH_GUARD
#error "Define XH_GUARD(id, visits) for the host or target Hook runtime"
#endif

/* Native tests use a no-op adapter. Recalculate cumulative budgets in Hooks. */
static inline int xh_nibble(uint8_t c)
{
    if (c >= '0' && c <= '9') return (int)(c - '0');
    if (c >= 'a' && c <= 'f') return (int)(c - 'a') + 10;
    if (c >= 'A' && c <= 'F') return (int)(c - 'A') + 10;
    return -1;
}

/* Up to 64 bytes. On failure the caller must discard partial output. */
static inline int xh_unhex(uint8_t *out, size_t cap,
                           const uint8_t *in, size_t len)
{
    if (!out || !in || len > 128U || (len & 1U) || len / 2U > cap)
        return -1;
    for (size_t i = 0; XH_GUARD(0x1001U, 65U), i < len / 2U; ++i) {
        int a = xh_nibble(in[i * 2U]), b = xh_nibble(in[i * 2U + 1U]);
        if (a < 0 || b < 0) return -1;
        out[i] = (uint8_t)((unsigned)a * 16U + (unsigned)b);
    }
    return (int)(len / 2U);
}

/* Entire field must be decimal digits, length 1..20; output unchanged on error. */
static inline int xh_decimal_u64(uint64_t *out, const uint8_t *in, size_t len)
{
    if (!out || !in || len == 0 || len > 20U) return 0;
    uint64_t value = 0;
    for (size_t i = 0; XH_GUARD(0x1002U, 21U), i < len; ++i) {
        if (in[i] < '0' || in[i] > '9') return 0;
        uint64_t digit = (uint64_t)(in[i] - '0');
        if (value > (UINT64_MAX - digit) / 10U) return 0;
        value = value * 10U + digit;
    }
    *out = value;
    return 1;
}

static inline int xh_write_u64be(uint8_t *out, size_t cap, uint64_t value)
{
    if (!out || cap < 8U) return 0;
    for (size_t i = 0; XH_GUARD(0x1003U, 9U), i < 8U; ++i)
        out[i] = (uint8_t)(value >> ((7U - i) * 8U));
    return 1;
}
#endif
