#ifndef XH_VARIABLE_STATE_H
#define XH_VARIABLE_STATE_H
#include <stddef.h>
#include <stdint.h>
#include <string.h>
/* Native teaching codec. Payload is opaque bytes; UTF-8 validation is a caller duty.
 * Not a production Hook helper: memcpy/loops need target compiler/guard validation. */
static int xh_label_key(uint8_t *out, size_t cap, const uint8_t *label, size_t n)
{
    if (!out || !label || cap < 32 || n < 1 || n > 28) return 0;
    for (size_t i=0; i<n; ++i)
        if (!((label[i]>='a' && label[i]<='z') || (label[i]>='0' && label[i]<='9') || label[i]=='-')) return 0;
    memset(out, 0, 32); memcpy(out, "SLK1", 4); memcpy(out+4, label, n); return 1;
}
static int xh_text_encode(uint8_t *out, size_t cap, const uint8_t *payload, size_t n)
{
    if (!out || !payload || n < 1 || n > 200 || cap < n+3) return -1;
    out[0]=1; out[1]=(uint8_t)(n>>8); out[2]=(uint8_t)n;
    memcpy(out+3, payload, n); return (int)(n+3);
}
static int xh_text_decode(const uint8_t *data, size_t n, const uint8_t **payload)
{
    if (!data || !payload || n < 4 || data[0]!=1) return -1;
    size_t len=((size_t)data[1]<<8)|data[2];
    if (len < 1 || len > 200 || n != len+3) return -1;
    *payload=data+3; return (int)len;
}
#endif
