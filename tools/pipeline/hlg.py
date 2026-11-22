"""HLG / PQ to SDR filter-chain generators.

hlg_to_sdr_vf  : stock-filter tone-map for iPhone HLG (needs no zscale/libplacebo).
                 Math: BT.2100 HLG inverse OETF + OOTF (system gamma 1.2, Lw 1000 nit),
                 BT.2020 -> BT.709 primaries in linear light, 203-nit diffuse white = 1.0,
                 soft-rolled highlights, BT.709 OETF. Per-channel OOTF is an approximation
                 of the BT.2100 luminance-based OOTF (slightly raises saturation).
                 Look versus Apple's own rendering of skin is UNVERIFIED; tune knee/ootf_gamma.
zscale_tonemap_vf: used only when this ffmpeg has zscale (handles PQ as well).
"""


def hlg_to_sdr_vf(w=1080, h=1920, fps=30, knee=0.8, ootf_gamma=1.2, ref_white_nits=203.0, lw=1000.0):
    a, b, c = 0.17883277, 0.28466892, 0.55991073  # BT.2100 HLG OETF constants
    inv = ("st(0,val/maxval); pow(if(lte(ld(0),0.5), ld(0)*ld(0)/3, "
           "(exp((ld(0)-%s)/%s)+%s)/12),%s)*maxval" % (c, a, b, ootf_gamma))
    k = knee
    sdr = ("st(1,val/maxval*%.4f); "
           "st(2,if(lte(ld(1),%s), ld(1), %s+%.3f*(ld(1)-%s)/((ld(1)-%s)+%.3f))); "
           "clip(if(lt(ld(2),0.018), 4.5*ld(2), 1.099*pow(ld(2),0.45)-0.099),0,1)*maxval"
           % (lw / ref_white_nits, k, k, 1 - k, k, k, 1 - k))

    def rgb(e):
        return "lutrgb=r='%s':g='%s':b='%s'" % (e, e, e)

    return ",".join([
        "scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d,fps=%d" % (w, h, w, h, fps),
        "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv",
        "scale=in_color_matrix=bt2020:in_range=tv:out_range=pc:flags=bicubic,format=gbrp16le",
        rgb(inv),
        "colorchannelmixer=rr=1.6605:rg=-0.5876:rb=-0.0728:gr=-0.1246:gg=1.1329:gb=-0.0083:br=-0.0182:bg=-0.1006:bb=1.1187",
        rgb(sdr),
        "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd,format=yuv420p",
        "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
    ])


def zscale_tonemap_vf(w=1080, h=1920, fps=30):
    """Standard zscale + hable tone-map (HLG or PQ). Only valid if ffmpeg has zscale."""
    return ",".join([
        "scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d,fps=%d" % (w, h, w, h, fps),
        "zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709",
        "tonemap=tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p",
        "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
    ])


def sdr_vf(w=1080, h=1920, fps=30):
    return ("scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d,fps=%d,format=yuv420p,"
            "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" % (w, h, w, h, fps))


def detect_hdr(color_transfer):
    """-> 'hlg' | 'pq' | None"""
    if color_transfer == "arib-std-b67":
        return "hlg"
    if color_transfer == "smpte2084":
        return "pq"
    return None
