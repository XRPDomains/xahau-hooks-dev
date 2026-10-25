#define XH_GUARD(id, visits) ((void)(id), (void)(visits))
#include "safe-bytes.h"
#include <assert.h>
#include <string.h>

int main(void)
{
    uint8_t output[66]; memset(output, 0xA5, sizeof(output));
    assert(xh_unhex(output + 1, 1, (const uint8_t *)"fF", 2) == 1);
    assert(output[0] == 0xA5 && output[1] == 255 && output[2] == 0xA5);
    assert(xh_unhex(output, 0, (const uint8_t *)"00", 2) == -1);
    assert(xh_unhex(output, 64, (const uint8_t *)"0", 1) == -1);
    assert(xh_unhex(output, 64, (const uint8_t *)"0g", 2) == -1);
    uint8_t max_hex[128]; memset(max_hex, 'F', sizeof(max_hex));
    assert(xh_unhex(output + 1, 64, max_hex, sizeof(max_hex)) == 64);
    assert(output[0] == 0xA5 && output[65] == 0xA5);

    uint64_t n = 7;
    assert(xh_decimal_u64(&n, (const uint8_t *)"18446744073709551615", 20));
    assert(n == UINT64_MAX);
    assert(!xh_decimal_u64(&n, (const uint8_t *)"18446744073709551616", 20));
    assert(n == UINT64_MAX);
    assert(!xh_decimal_u64(&n, (const uint8_t *)"1e3", 3));
    assert(!xh_decimal_u64(&n, (const uint8_t *)"1 e3", 4));
    assert(!xh_decimal_u64(&n, (const uint8_t *)"", 0));
    assert(!xh_decimal_u64(&n, (const uint8_t *)"-1", 2));
    assert(xh_decimal_u64(&n, (const uint8_t *)"0", 1) && n == 0);
    memset(output, 0xA5, sizeof(output));
    assert(!xh_write_u64be(output, 7, UINT64_MAX));
    assert(output[0] == 0xA5);
    assert(xh_write_u64be(output + 1, 8, UINT64_C(0x0102030405060708)));
    for (size_t i = 0; i < 8; ++i) assert(output[1+i] == i+1);
    assert(output[0] == 0xA5 && output[9] == 0xA5);
    return 0;
}
