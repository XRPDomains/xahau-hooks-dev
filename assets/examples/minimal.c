#include "hookapi.h"

int64_t hook(uint32_t context)
{
    (void)context;
    _g(1, 1);
    const uint8_t message[] = "pass";
    return accept((uint32_t)message, sizeof(message) - 1U, 0);
}
