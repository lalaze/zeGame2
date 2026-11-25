class_name JsMath
extends RefCounted

# Bit-exact JavaScript (Node 22 / V8 12.4) numeric primitives in pure GDScript:
# - IEEE 754 bit inspection/construction
# - 32-bit integer ops (ToInt32, ToUint32, Math.imul, >>>, >>, <<, ^, &, |, ~)
# - Math.round, Math.hypot (V8 Kahan)
# - V8 fdlibm: Math.log, Math.log10, Math.pow
# - Exact correctly-rounded decimal-to-double (parse_float)
# - Exact Ryu shortest-round-trip double-to-decimal (number_to_string)
# - Exact ECMAScript to_fixed and to_exponential

static var _buf: PackedByteArray = PackedByteArray()
static var _pow10_exact: PackedFloat64Array = PackedFloat64Array()
static var _ryu_inv_cache: Dictionary = {} # q -> Array[int] (5 limbs of 30 bits)
static var _ryu_pos_cache: Dictionary = {} # i -> Array[int] (5 limbs of 30 bits)
static var _pow5_bits_cache: PackedInt32Array = PackedInt32Array()

const DOUBLE_POW5_INV_BITCOUNT: int = 125
const DOUBLE_POW5_BITCOUNT: int = 125
const CANONICAL_NAN_BITS: int = 0x7ff8000000000000
const NEG_ZERO_BITS: int = -9223372036854775808 # 0x8000000000000000 as signed int64

# Cached exact IEEE 754 constants (initialized once from bit patterns so GDScript's float parser never alters them).
static var _inited: bool = false
static var _C_LN2_HI: float
static var _C_LN2_LO: float
static var _C_TWO54: float
static var _C_TWO53: float
static var _C_LG1: float
static var _C_LG2: float
static var _C_LG3: float
static var _C_LG4: float
static var _C_LG5: float
static var _C_LG6: float
static var _C_LG7: float
static var _C_ONE_THIRD: float
static var _C_IVLN10_HI: float
static var _C_IVLN10_LO: float
static var _C_LOG10_2HI: float
static var _C_LOG10_2LO: float
static var _C_BP1: float
static var _C_DP_H1: float
static var _C_DP_L1: float
static var _C_L1: float
static var _C_L2: float
static var _C_L3: float
static var _C_L4: float
static var _C_L5: float
static var _C_L6: float
static var _C_P1: float
static var _C_P2: float
static var _C_P3: float
static var _C_P4: float
static var _C_P5: float
static var _C_LG2_POW: float
static var _C_LG2_H: float
static var _C_LG2_L: float
static var _C_OVT: float
static var _C_CP: float
static var _C_CP_H: float
static var _C_CP_L: float
static var _C_IVLN2: float
static var _C_IVLN2_H: float
static var _C_IVLN2_L: float
static var _C_HUGE: float
static var _C_TINY: float
static var _C_IVLN10: float
static var _NEG_ZERO: float

static func _ensure_init() -> void:
	if _inited:
		return
	_inited = true
	_buf.resize(8)
	_pow10_exact.resize(23)
	var p := 1.0
	for i in range(23):
		_pow10_exact[i] = p
		p *= 10.0

	_C_LN2_HI = from_words(0x3fe62e42, 0xfee00000)
	_C_LN2_LO = from_words(0x3dea39ef, 0x35793c76)
	_C_TWO54 = from_words(0x43500000, 0x00000000)
	_C_TWO53 = from_words(0x43400000, 0x00000000)
	_C_LG1 = from_words(0x3fe55555, 0x55555593)
	_C_LG2 = from_words(0x3fd99999, 0x9997fa04)
	_C_LG3 = from_words(0x3fd24924, 0x94229359)
	_C_LG4 = from_words(0x3fcc71c5, 0x1d8e78af)
	_C_LG5 = from_words(0x3fc74664, 0x96cb03de)
	_C_LG6 = from_words(0x3fc39a09, 0xd078c69f)
	_C_LG7 = from_words(0x3fc2f112, 0xdf3e5244)
	_C_ONE_THIRD = from_words(0x3fd55555, 0x55555555)

	_C_IVLN10_HI = from_words(0x3fdbcb7b, 0x15200000)
	_C_IVLN10_LO = from_words(0x3dbb9438, 0xca9aadd5)
	_C_LOG10_2HI = from_words(0x3fd34413, 0x509f6000)
	_C_LOG10_2LO = from_words(0x3d59fef3, 0x11f12b36)

	_C_BP1 = from_words(0x3ff80000, 0x00000000) # 1.5
	_C_DP_H1 = from_words(0x3fe2b803, 0x40000000)
	_C_DP_L1 = from_words(0x3e4cfdeb, 0x43cfd006)
	_C_L1 = from_words(0x3fe33333, 0x33333303)
	_C_L2 = from_words(0x3fdb6db6, 0xdb6fabff)
	_C_L3 = from_words(0x3fd55555, 0x518f264d)
	_C_L4 = from_words(0x3fd17460, 0xa91d4101)
	_C_L5 = from_words(0x3fcd864a, 0x93c9db65)
	_C_L6 = from_words(0x3fca7e28, 0x4a454eef)
	_C_P1 = from_words(0x3fc55555, 0x5555553e)
	_C_P2 = from_words(0xbf66c16c, 0x16bebd93)
	_C_P3 = from_words(0x3f11566a, 0xaf25de2c)
	_C_P4 = from_words(0xbebbbd41, 0xc5d26bf1)
	_C_P5 = from_words(0x3e663769, 0x72bea4d0)
	_C_LG2_POW = from_words(0x3fe62e42, 0xfefa39ef)
	_C_LG2_H = from_words(0x3fe62e43, 0x00000000)
	_C_LG2_L = from_words(0xbe205c61, 0x0ca86c39)
	_C_OVT = from_words(0x3c971547, 0x652b82fe) # 8.0085662595372944372e-0017
	# Exact fdlibm e_pow.c hex constants:
	# cp   =  9.61796693925975554329e-01 = 0x3FEEC709, 0xDC3A03FD
	# cp_h =  9.61796700954437255859e-01 = 0x3FEEC709, 0xE0000000
	# cp_l = -7.02846165095275826516e-09 = 0xBE3E2FE0, 0x145B01F5
	_C_CP = from_words(0x3feec709, 0xdc3a03fd)
	_C_CP_H = from_words(0x3feec709, 0xe0000000)
	_C_CP_L = from_words(0xbe3e2fe0, 0x145b01f5)
	_C_IVLN2 = from_words(0x3ff71547, 0x652b82fe)
	_C_IVLN2_H = from_words(0x3ff71547, 0x60000000)
	_C_IVLN2_L = from_words(0x3e54ae0b, 0xf85ddf44)
	_C_HUGE = from_words(0x7e37e43c, 0x8800759c) # 1e300
	_C_TINY = from_words(0x01a56e1f, 0xc2f8f359) # 1e-300
	_C_IVLN10 = from_words(0x3fdbcb7b, 0x1526e50e) # 1/ln(10)
	_NEG_ZERO = bits_to_float(NEG_ZERO_BITS)

# ---------------------------------------------------------------- IEEE 754 bits

static func float_to_bits(x: float) -> int:
	if _buf.size() != 8:
		_buf.resize(8)
	_buf.encode_double(0, x)
	return _buf.decode_s64(0)

static func bits_to_float(bits: int) -> float:
	if _buf.size() != 8:
		_buf.resize(8)
	_buf.encode_s64(0, bits)
	return _buf.decode_double(0)

static func from_words(hi: int, lo: int) -> float:
	return bits_to_float(((hi & 0xffffffff) << 32) | (lo & 0xffffffff))

static func hi_word_s(x: float) -> int:
	var h := (float_to_bits(x) >> 32) & 0xffffffff
	if h >= 0x80000000:
		h -= 0x100000000
	return h

static func hi_word_u(x: float) -> int:
	return (float_to_bits(x) >> 32) & 0xffffffff

static func lo_word_u(x: float) -> int:
	return float_to_bits(x) & 0xffffffff

static func set_hi(x: float, hi: int) -> float:
	var lo := lo_word_u(x)
	return from_words(hi, lo)

static func set_lo(x: float, lo: int) -> float:
	var hi := hi_word_u(x)
	return from_words(hi, lo)

static func float_to_hex(x: float) -> String:
	var bits := CANONICAL_NAN_BITS if is_nan(x) else float_to_bits(x)
	var hi := (bits >> 32) & 0xffffffff
	var lo := bits & 0xffffffff
	return "%08x%08x" % [hi, lo]

## The eight bytes low byte first, as Node's writeDoubleLE gives them; one form for every NaN.
static func float_to_hex_le(x: float) -> String:
	if is_nan(x):
		return "000000000000f87f"
	_hex_buffer.encode_double(0, x)
	return _hex_buffer.hex_encode()

static var _hex_buffer: PackedByteArray = [0, 0, 0, 0, 0, 0, 0, 0]

static func hex_to_float(s: String) -> float:
	var hi := ("0x" + s.substr(0, 8)).hex_to_int()
	var lo := ("0x" + s.substr(8, 8)).hex_to_int()
	return from_words(hi, lo)

static func is_neg_zero(x: float) -> bool:
	return x == 0.0 and float_to_bits(x) == NEG_ZERO_BITS

static func is_finite_num(v: Variant) -> bool:
	if v is float:
		return is_finite(v)
	return v is int

static func is_integer(v: Variant) -> bool:
	if v is int:
		return true
	if v is float:
		return is_finite(v) and floor(v) == v
	return false

static func is_safe_integer(v: Variant) -> bool:
	if v is int:
		return absi(v) <= 9007199254740991
	if v is float:
		return is_finite(v) and floor(v) == v and absf(v) < 9007199254740992.0
	return false

static func same_value(a: float, b: float) -> bool:
	if is_nan(a) and is_nan(b):
		return true
	return float_to_bits(a) == float_to_bits(b)

# ---------------------------------------------------------------- 32-bit integer ops

static func to_uint32(x: float) -> int:
	if not is_finite(x) or x == 0.0:
		return 0
	var n: float = floor(x) if x >= 0.0 else ceil(x)
	var m := fmod(n, 4294967296.0)
	if m < 0.0:
		m += 4294967296.0
	return int(m) & 0xffffffff

static func to_int32(x: float) -> int:
	var u := to_uint32(x)
	if u >= 0x80000000:
		return u - 0x100000000
	return u

static func imul_i(a: int, b: int) -> int:
	var ua := a & 0xffffffff
	var ub := b & 0xffffffff
	var al := ua & 0xffff
	var ah := (ua >> 16) & 0xffff
	var bl := ub & 0xffff
	var bh := (ub >> 16) & 0xffff
	var res := (al * bl + (((ah * bl + al * bh) & 0xffff) << 16)) & 0xffffffff
	if res >= 0x80000000:
		res -= 0x100000000
	return res

static func imul(a: float, b: float) -> float:
	return float(imul_i(to_int32(a), to_int32(b)))

static func ushr_i(a: int, b: int) -> int:
	return ((a & 0xffffffff) >> (b & 31)) & 0xffffffff

static func ushr(a: float, b: float) -> float:
	return float(ushr_i(to_uint32(a), to_uint32(b)))

static func shr_i(a: int, b: int) -> int:
	var ua := a & 0xffffffff
	if ua >= 0x80000000:
		ua -= 0x100000000
	return ua >> (b & 31)

static func shr(a: float, b: float) -> float:
	return float(shr_i(to_int32(a), to_uint32(b)))

static func shl_i(a: int, b: int) -> int:
	var res := ((a & 0xffffffff) << (b & 31)) & 0xffffffff
	if res >= 0x80000000:
		res -= 0x100000000
	return res

static func shl(a: float, b: float) -> float:
	return float(shl_i(to_int32(a), to_uint32(b)))

static func bxor_i(a: int, b: int) -> int:
	var res := ((a & 0xffffffff) ^ (b & 0xffffffff)) & 0xffffffff
	if res >= 0x80000000:
		res -= 0x100000000
	return res

static func bxor(a: float, b: float) -> float:
	return float(bxor_i(to_int32(a), to_int32(b)))

static func band_i(a: int, b: int) -> int:
	var res := ((a & 0xffffffff) & (b & 0xffffffff)) & 0xffffffff
	if res >= 0x80000000:
		res -= 0x100000000
	return res

static func bor_i(a: int, b: int) -> int:
	var res := ((a & 0xffffffff) | (b & 0xffffffff)) & 0xffffffff
	if res >= 0x80000000:
		res -= 0x100000000
	return res

# ---------------------------------------------------------------- Math.round & Math.hypot

## Math.max and Math.min: NaN wins, and 0 counts as greater than -0 (Godot's maxf and minf do neither).
static func js_max(a: float, b: float) -> float:
	if a > b:
		return a
	if b > a:
		return b
	return a + b if a == 0.0 and b == 0.0 else (a if a == b else NAN)

static func js_min(a: float, b: float) -> float:
	if a < b:
		return a
	if b < a:
		return b
	return -(-a - b) if a == 0.0 and b == 0.0 else (a if a == b else NAN)

static func js_round(x: float) -> float:
	_ensure_init()
	if is_nan(x) or is_inf(x) or x == 0.0:
		return x
	if x < 0.0 and x >= -0.5:
		return _NEG_ZERO
	if x > 0.0 and x < 0.5:
		return 0.0
	if absf(x) >= 4503599627370496.0:
		return x
	var f: float = floor(x)
	if x - f >= 0.5:
		return f + 1.0
	return f

static func js_hypot2(a: float, b: float) -> float:
	if is_inf(a) or is_inf(b):
		return INF
	if is_nan(a) or is_nan(b):
		return NAN
	var aa := absf(a)
	var bb := absf(b)
	var m := maxf(aa, bb)
	if m == 0.0:
		return 0.0
	var s := 0.0
	var c := 0.0
	var n1 := aa / m
	var u1 := n1 * n1 - c
	var p1 := s + u1
	c = p1 - s - u1
	s = p1
	var n2 := bb / m
	var u2 := n2 * n2 - c
	var p2 := s + u2
	c = p2 - s - u2
	s = p2
	return sqrt(s) * m

static func js_hypot(vals: Array) -> float:
	if vals.is_empty():
		return 0.0
	var has_nan := false
	var m := 0.0
	for v in vals:
		var x := float(v)
		if is_inf(x):
			return INF
		if is_nan(x):
			has_nan = true
		else:
			var ax := absf(x)
			if ax > m:
				m = ax
	if has_nan:
		return NAN
	if m == 0.0:
		return 0.0
	var s := 0.0
	var c := 0.0
	for v in vals:
		var n := absf(float(v)) / m
		var u := n * n - c
		var p := s + u
		c = p - s - u
		s = p
	return sqrt(s) * m

# ---------------------------------------------------------------- V8 fdlibm: log, log10, pow
# Exact IEEE 754 FMA (Boldo-Melquiond round-to-odd) so GDScript matches V8 12.4 on ARM64
# where Clang contracts single-expression a*b+c into hardware FMA (-ffp-contract=on).

static func _fma(a: float, b: float, c: float) -> float:
	var p := a * b
	var ca := 134217729.0 * a
	var a_hi := ca - (ca - a)
	var a_lo := a - a_hi
	var cb := 134217729.0 * b
	var b_hi := cb - (cb - b)
	var b_lo := b - b_hi
	var err := ((a_hi * b_hi - p) + a_hi * b_lo + a_lo * b_hi) + a_lo * b_lo
	var s := p + c
	var v := s - p
	var t := (p - (s - v)) + (c - v)
	var u := t + err
	var vu := u - t
	var w := (t - (u - vu)) + (err - vu)
	if w != 0.0 and u != 0.0 and is_finite(u):
		var ubits := float_to_bits(u)
		if (ubits & 1) == 0:
			var same_sign := (u > 0.0) == (w > 0.0)
			u = bits_to_float(ubits + (1 if same_sign else -1))
	return s + u

static func js_log(x: float) -> float:
	_ensure_init()
	var hx := hi_word_s(x)
	var lx := lo_word_u(x)
	var k := 0
	if hx < 0x00100000:
		if ((hx & 0x7fffffff) | lx) == 0:
			return -INF
		if hx < 0:
			return NAN
		k -= 54
		x *= _C_TWO54
		hx = hi_word_s(x)
	if hx >= 0x7ff00000:
		return x + x
	k += (hx >> 20) - 1023
	hx &= 0x000fffff
	var i := (hx + 0x95f64) & 0x100000
	x = set_hi(x, hx | (i ^ 0x3ff00000))
	k += (i >> 20)
	var f := x - 1.0
	if (0x000fffff & (2 + hx)) < 3:
		if f == 0.0:
			if k == 0:
				return 0.0
			var dk0 := float(k)
			return _fma(dk0, _C_LN2_HI, dk0 * _C_LN2_LO)
		var R0 := f * f * _fma(-_C_ONE_THIRD, f, 0.5)
		if k == 0:
			return f - R0
		var dk1 := float(k)
		return _fma(dk1, _C_LN2_HI, -(_fma(-dk1, _C_LN2_LO, R0) - f))
	var s := f / (2.0 + f)
	var dk := float(k)
	var z := s * s
	i = hx - 0x6147a
	var w := z * z
	var j := 0x6b851 - hx
	var t1 := w * _fma(w, _fma(w, _C_LG6, _C_LG4), _C_LG2)
	var t2 := z * _fma(w, _fma(w, _fma(w, _C_LG7, _C_LG5), _C_LG3), _C_LG1)
	i |= j
	var R := t2 + t1
	if i > 0:
		var hfsq := 0.5 * f * f
		if k == 0:
			return f - _fma(-s, hfsq + R, hfsq)
		return _fma(dk, _C_LN2_HI, -((hfsq - _fma(s, hfsq + R, dk * _C_LN2_LO)) - f))
	else:
		if k == 0:
			return _fma(-s, f - R, f)
		return _fma(dk, _C_LN2_HI, -(_fma(s, f - R, -(dk * _C_LN2_LO)) - f))

static func js_log10(x: float) -> float:
	# Exact V8 src/base/ieee754.cc log10
	_ensure_init()
	var hx := hi_word_s(x)
	var lx := lo_word_u(x)
	var k := 0
	if hx < 0x00100000:
		if ((hx & 0x7fffffff) | lx) == 0:
			return -INF
		if hx < 0:
			return NAN
		k -= 54
		x *= _C_TWO54
		hx = hi_word_s(x)
		lx = lo_word_u(x)
	if hx >= 0x7ff00000:
		return x + x
	if hx == 0x3ff00000 and lx == 0:
		return 0.0
	k += (hx >> 20) - 1023
	var i := 1 if k < 0 else 0
	hx = (hx & 0x000fffff) | ((0x3ff - i) << 20)
	var y := float(k + i)
	x = from_words(hx, lx)
	var z := y * _C_LOG10_2LO + _C_IVLN10 * js_log(x)
	return z + y * _C_LOG10_2HI

static func js_pow(x: float, y: float) -> float:
	# Exact V8 src/base/ieee754.cc pow
	_ensure_init()
	var hx := hi_word_s(x)
	var lx := lo_word_u(x)
	var hy := hi_word_s(y)
	var ly := lo_word_u(y)
	var ix := hx & 0x7fffffff
	var iy := hy & 0x7fffffff

	# y==zero: x**0 = 1
	if (iy | ly) == 0:
		return 1.0
	# +-NaN return x+y
	if ix > 0x7ff00000 or (ix == 0x7ff00000 and lx != 0) or iy > 0x7ff00000 or (iy == 0x7ff00000 and ly != 0):
		return NAN

	var yisint := 0
	if hx < 0:
		if iy >= 0x43400000:
			yisint = 2
		elif iy >= 0x3ff00000:
			var k_int := (iy >> 20) - 0x3ff
			if k_int > 20:
				var j_int := ly >> (52 - k_int)
				if ((j_int << (52 - k_int)) & 0xffffffff) == ly:
					yisint = 2 - (j_int & 1)
			elif ly == 0:
				var j_int := iy >> (20 - k_int)
				if (j_int << (20 - k_int)) == iy:
					yisint = 2 - (j_int & 1)

	# Special value of y
	if ly == 0:
		if iy == 0x7ff00000: # y is +-inf
			if ((ix - 0x3ff00000) | lx) == 0:
				return NAN
			elif ix >= 0x3ff00000:
				return y if hy >= 0 else 0.0
			else:
				return -y if hy < 0 else 0.0
		if iy == 0x3ff00000: # y is +-1
			if hy < 0:
				return 1.0 / x
			return x
		if hy == 0x40000000:
			return x * x
		if hy == 0x3fe00000:
			if hx >= 0:
				return sqrt(x)

	var ax := absf(x)
	# Special value of x
	if lx == 0:
		if ix == 0x7ff00000 or ix == 0 or ix == 0x3ff00000:
			var z0 := ax
			if hy < 0:
				z0 = 1.0 / z0
			if hx < 0:
				if ((ix - 0x3ff00000) | yisint) == 0:
					z0 = NAN
				elif yisint == 1:
					z0 = -z0
			return z0

	var s := 1.0
	if hx < 0:
		if yisint == 0:
			return NAN
		if yisint == 1:
			s = -1.0

	# |y| is huge
	if iy > 0x41e00000:
		if iy > 0x43f00000:
			if ix <= 0x3fefffff:
				return (_C_HUGE * _C_HUGE) if hy < 0 else (_C_TINY * _C_TINY)
			if ix >= 0x3ff00000:
				return (_C_HUGE * _C_HUGE) if hy > 0 else (_C_TINY * _C_TINY)
		if ix < 0x3fefffff:
			return (s * _C_HUGE * _C_HUGE) if hy < 0 else (s * _C_TINY * _C_TINY)
		if ix > 0x3ff00000:
			return (s * _C_HUGE * _C_HUGE) if hy > 0 else (s * _C_TINY * _C_TINY)
		var t_h := ax - 1.0
		var w_h := (t_h * t_h) * _fma(-t_h, _fma(-t_h, 0.25, _C_ONE_THIRD), 0.5)
		var u_h := _C_IVLN2_H * t_h
		var v_h := _fma(t_h, _C_IVLN2_L, -(w_h * _C_IVLN2))
		var t1_h := u_h + v_h
		t1_h = set_lo(t1_h, 0)
		var t2_h := v_h - (t1_h - u_h)
		return _pow_final_exp(s, y, t1_h, t2_h)

	var t1: float
	var t2: float
	var n := 0
	if ix < 0x00100000:
		ax *= _C_TWO53
		n -= 53
		ix = hi_word_s(ax)
	n += (ix >> 20) - 0x3ff
	var j := ix & 0x000fffff
	ix = j | 0x3ff00000
	var k := 0
	if j <= 0x3988e:
		k = 0
	elif j < 0xbb67a:
		k = 1
	else:
		k = 0
		n += 1
		ix -= 0x00100000
	ax = set_hi(ax, ix)

	var bp_k := 1.0 if k == 0 else _C_BP1
	var u := ax - bp_k
	var v := 1.0 / (ax + bp_k)
	var ss := u * v
	var s_h := set_lo(ss, 0)
	var t_h := set_hi(0.0, ((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18))
	var t_l := ax - (t_h - bp_k)
	var s_l := v * _fma(-s_h, t_l, _fma(-s_h, t_h, u))
	var s2 := ss * ss
	var r := s2 * s2 * _fma(s2, _fma(s2, _fma(s2, _fma(s2, _fma(s2, _C_L6, _C_L5), _C_L4), _C_L3), _C_L2), _C_L1)
	r = _fma(s_l, s_h + ss, r)
	s2 = s_h * s_h
	t_h = 3.0 + s2 + r
	t_h = set_lo(t_h, 0)
	t_l = r - ((t_h - 3.0) - s2)
	u = s_h * t_h
	v = _fma(t_l, ss, s_l * t_h)
	var p_h := set_lo(u + v, 0)
	var p_l := v - (p_h - u)
	var z_h := _C_CP_H * p_h
	var dp_l_k := 0.0 if k == 0 else _C_DP_L1
	var dp_h_k := 0.0 if k == 0 else _C_DP_H1
	var z_l := _fma(p_l, _C_CP, _C_CP_L * p_h) + dp_l_k
	var t := float(n)
	t1 = (((z_h + z_l) + dp_h_k) + t)
	t1 = set_lo(t1, 0)
	t2 = z_l - (((t1 - t) - dp_h_k) - z_h)
	return _pow_final_exp(s, y, t1, t2)

static func _pow_final_exp(s: float, y: float, t1: float, t2: float) -> float:
	var y1 := set_lo(y, 0)
	var p_l := _fma(y, t2, (y - y1) * t1)
	var p_h := y1 * t1
	var z := p_l + p_h
	var j := hi_word_s(z)
	var i := lo_word_u(z)
	if j >= 0x40900000:
		if ((j - 0x40900000) | i) != 0:
			return s * _C_HUGE * _C_HUGE
		else:
			if p_l + _C_OVT > z - p_h:
				return s * _C_HUGE * _C_HUGE
	elif (j & 0x7fffffff) >= 0x4090cc00:
		if ((j - (0xc090cc00 - 0x100000000)) | i) != 0:
			return s * _C_TINY * _C_TINY
		else:
			if p_l <= z - p_h:
				return s * _C_TINY * _C_TINY

	i = j & 0x7fffffff
	var k := (i >> 20) - 0x3ff
	var n := 0
	if i > 0x3fe00000:
		n = j + (0x00100000 >> (k + 1))
		k = ((n & 0x7fffffff) >> 20) - 0x3ff
		var t_sub := set_hi(0.0, n & ~(0x000fffff >> k))
		n = ((n & 0x000fffff) | 0x00100000) >> (20 - k)
		if j < 0:
			n = -n
		p_h -= t_sub
	var t := p_l + p_h
	t = set_lo(t, 0)
	var u := t * _C_LG2_H
	var v := _fma(t, _C_LG2_L, (p_l - (t - p_h)) * _C_LG2_POW)
	z = u + v
	var w := v - (z - u)
	t = z * z
	t1 = _fma(-t, _fma(t, _fma(t, _fma(t, _fma(t, _C_P5, _C_P4), _C_P3), _C_P2), _C_P1), z)
	var r := (z * t1) / ((t1 - 2.0) - _fma(z, w, w))
	z = 1.0 - (r - z)
	j = hi_word_s(z)
	j += (n << 20)
	if (j >> 20) <= 0:
		z = _scalbn(z, n)
	else:
		z = set_hi(z, j)
	return s * z

static func _scalbn(x: float, n: int) -> float:
	# Exact IEEE 754 scalbn(x, n) for subnormal/overflow scaling in e_pow.
	var hx := hi_word_s(x)
	var lx := lo_word_u(x)
	var k := (hx & 0x7ff00000) >> 20
	if k == 0:
		if (lx | (hx & 0x7fffffff)) == 0:
			return x
		x *= _C_TWO54
		hx = hi_word_s(x)
		k = ((hx & 0x7ff00000) >> 20) - 54
		if n < -50000:
			return _C_TINY * x
	if k == 0x7ff:
		return x + x
	k = k + n
	if k > 0x7fe:
		return _C_HUGE * (1.0 if x >= 0.0 else -1.0) * _C_HUGE
	if k > 0:
		return set_hi(x, (hx & (0x800fffff - 0x100000000)) | (k << 20))
	if k <= -54:
		if n > 50000:
			return _C_HUGE * (1.0 if x >= 0.0 else -1.0) * _C_HUGE
		return _C_TINY * (1.0 if x >= 0.0 else -1.0) * _C_TINY
	k += 54
	x = set_hi(x, (hx & (0x800fffff - 0x100000000)) | (k << 20))
	return x * from_words(0x3c900000, 0x00000000) # 2^-54

# ---------------------------------------------------------------- Exact decimal-to-double (parse_float)

static func parse_float(raw: String) -> float:
	# Correctly-rounded IEEE 754 decimal string to double, matching JS Number(s) / JSON.parse.
	_ensure_init()
	var s := JsUtil.js_trim(raw)
	if s.is_empty():
		return 0.0
	var n := s.length()
	var i := 0
	var neg := false
	var c0 := s.unicode_at(0)
	if c0 == 45: # '-'
		neg = true
		i = 1
	elif c0 == 43: # '+'
		i = 1
	if i >= n:
		return NAN
	var rest := s.substr(i)
	if rest == "Infinity":
		return -INF if neg else INF
	if rest == "NaN":
		return NAN

	# Collect significant digits and decimal exponent.
	var digits_arr: PackedByteArray = PackedByteArray()
	var seen_digit := false
	var seen_dot := false
	var frac_digits := 0
	while i < n:
		var ch := s.unicode_at(i)
		if ch >= 48 and ch <= 57:
			seen_digit = true
			if not (digits_arr.is_empty() and ch == 48):
				digits_arr.append(ch)
			if seen_dot:
				frac_digits += 1
			i += 1
		elif ch == 46 and not seen_dot: # '.'
			seen_dot = true
			i += 1
		else:
			break
	if not seen_digit:
		return NAN

	var exp_val := 0
	if i < n:
		var ech := s.unicode_at(i)
		if ech == 101 or ech == 69: # 'e' or 'E'
			i += 1
			var eneg := false
			if i < n:
				var sch := s.unicode_at(i)
				if sch == 45:
					eneg = true
					i += 1
				elif sch == 43:
					i += 1
			var seen_exp := false
			while i < n:
				var dch := s.unicode_at(i)
				if dch >= 48 and dch <= 57:
					seen_exp = true
					if exp_val < 1000000:
						exp_val = exp_val * 10 + (dch - 48)
					i += 1
				else:
					break
			if not seen_exp:
				return NAN
			if eneg:
				exp_val = -exp_val
	if i != n:
		return NAN

	# Trim trailing zeros from digits_arr
	var sig_len := digits_arr.size()
	var dec_exp := exp_val - frac_digits
	while sig_len > 0 and digits_arr[sig_len - 1] == 48:
		sig_len -= 1
		dec_exp += 1
	if sig_len == 0:
		return _NEG_ZERO if neg else 0.0

	# Check overflow/underflow bounds: value is approx d * 10^(dec_exp + sig_len - 1)
	var mag := dec_exp + sig_len - 1
	if mag > 309:
		return -INF if neg else INF
	if mag < -326:
		return _NEG_ZERO if neg else 0.0

	# Fast path (Clinger): <= 15 significant digits and |dec_exp| <= 22 -> single exact double op!
	if sig_len <= 15 and dec_exp >= -22 and dec_exp <= 22:
		var mant := 0
		for j in range(sig_len):
			mant = mant * 10 + (digits_arr[j] - 48)
		var val := float(mant)
		if dec_exp > 0:
			val *= _pow10_exact[dec_exp]
		elif dec_exp < 0:
			val /= _pow10_exact[-dec_exp]
		return -val if neg else val

	# Exact fallback via JsBigInt (handles arbitrary length strings, subnormals, halfway ties).
	# Cap at 780 significant digits (beyond 768 digits, all remaining nonzero digits only affect sticky bit).
	var truncated := false
	var use_len := sig_len
	if use_len > 780:
		dec_exp += use_len - 780
		use_len = 780
		truncated = true
	var d_str := digits_arr.slice(0, use_len).get_string_from_ascii()
	var D := JsBigInt.from_decimal(d_str)
	if truncated:
		# Multiply by 10 and add 1 (sticky bit) to preserve exact inequality direction.
		D = JsBigInt.add_small(JsBigInt.mul_small(D, 10), 1)
		dec_exp -= 1

	# Exact rational value is D * 10^dec_exp = N / M
	# Choose binary exponent e2 such that (N / M) / 2^e2 is in [2^52, 2^53), or e2 = -1074 for subnormals.
	var num: PackedInt64Array
	var den: PackedInt64Array
	if dec_exp >= 0:
		num = JsBigInt.shl(JsBigInt.mul(D, JsBigInt.pow5(dec_exp)), dec_exp)
		den = JsBigInt.from_int(1)
	else:
		num = D
		den = JsBigInt.shl(JsBigInt.pow5(-dec_exp), -dec_exp)

	var nb := JsBigInt.bit_length(num)
	var db := JsBigInt.bit_length(den)
	# Estimate floor(log2(num / den)) = nb - db (or nb - db - 1)
	var exp2 := nb - db
	# Compare num with den << exp2 (adjusting shift)
	if exp2 >= 0:
		if JsBigInt.cmp(num, JsBigInt.shl(den, exp2)) < 0:
			exp2 -= 1
	else:
		if JsBigInt.cmp(JsBigInt.shl(num, -exp2), den) < 0:
			exp2 -= 1

	# Now 2^exp2 <= num / den < 2^(exp2 + 1).
	var ieee_exp: int
	var shift_e2: int
	if exp2 < -1022:
		# Subnormal or underflow
		ieee_exp = 0
		shift_e2 = -1074
	elif exp2 > 1023:
		return -INF if neg else INF
	else:
		ieee_exp = exp2 + 1023
		shift_e2 = exp2 - 52

	# Compute exact quotient q = floor((num / den) / 2^shift_e2) and remainder rem
	var q_num := num
	var q_den := den
	if shift_e2 > 0:
		q_den = JsBigInt.shl(den, shift_e2)
	elif shift_e2 < 0:
		q_num = JsBigInt.shl(num, -shift_e2)

	var dm := JsBigInt.divmod(q_num, q_den)
	var q_big: PackedInt64Array = dm[0]
	var rem_big: PackedInt64Array = dm[1]
	var q_pair := JsBigInt.to_u64_pair(q_big)
	var mant64: int = (q_pair[0] << 32) | q_pair[1]

	# Round to nearest, ties to even: compare 2 * rem_big with q_den
	var two_rem := JsBigInt.shl(rem_big, 1)
	var cmp_half := JsBigInt.cmp(two_rem, q_den)
	if cmp_half > 0 or (cmp_half == 0 and (mant64 & 1) == 1):
		mant64 += 1
		if ieee_exp == 0:
			if mant64 == (1 << 52):
				ieee_exp = 1
				mant64 = 0
		else:
			if mant64 == (1 << 53):
				mant64 >>= 1
				ieee_exp += 1
				if ieee_exp >= 0x7ff:
					return -INF if neg else INF

	var hi := ((1 << 31) if neg else 0) | ((ieee_exp & 0x7ff) << 20) | ((mant64 >> 32) & 0xfffff)
	var lo := mant64 & 0xffffffff
	return from_words(hi, lo)

# ---------------------------------------------------------------- Ryu d2d + JS Number::toString

static func _pow5_bits(e: int) -> int:
	if e == 0:
		return 1
	if _pow5_bits_cache.size() <= e:
		var old := _pow5_bits_cache.size()
		_pow5_bits_cache.resize(e + 1)
		for idx in range(old, e + 1):
			_pow5_bits_cache[idx] = JsBigInt.bit_length(JsBigInt.pow5(idx))
	return _pow5_bits_cache[e]

static func _bigint_to_5limbs(a: PackedInt64Array) -> Array[int]:
	var out: Array[int] = [0, 0, 0, 0, 0]
	var lim := mini(5, a.size())
	for i in range(lim):
		out[i] = a[i]
	return out

static func _ryu_inv_split(q: int) -> Array[int]:
	if _ryu_inv_cache.has(q):
		return _ryu_inv_cache[q]
	# floor(2^(DOUBLE_POW5_INV_BITCOUNT - 1 + pow5bits(q)) / 5^q) + 1
	var k := DOUBLE_POW5_INV_BITCOUNT - 1 + _pow5_bits(q)
	var num := JsBigInt.shl(JsBigInt.from_int(1), k)
	var dm := JsBigInt.divmod(num, JsBigInt.pow5(q))
	var val := JsBigInt.add_small(dm[0], 1)
	var limbs := _bigint_to_5limbs(val)
	_ryu_inv_cache[q] = limbs
	return limbs

static func _ryu_pos_split(i: int) -> Array[int]:
	if _ryu_pos_cache.has(i):
		return _ryu_pos_cache[i]
	# floor(5^i / 2^(pow5bits(i) - DOUBLE_POW5_BITCOUNT))
	var k := _pow5_bits(i) - DOUBLE_POW5_BITCOUNT
	var p5 := JsBigInt.pow5(i)
	var val := JsBigInt.shr(p5, k) if k >= 0 else JsBigInt.shl(p5, -k)
	var limbs := _bigint_to_5limbs(val)
	_ryu_pos_cache[i] = limbs
	return limbs

static func _mul_shift_ryu(m: int, mul_limbs: Array[int], j: int) -> int:
	# Computes floor((m * mul) / 2^j) where m < 2^56 (2 limbs of 30 bits) and mul < 2^126 (5 limbs of 30 bits).
	# Result is guaranteed < 2^60 (fits in positive signed int64).
	var m0 := m & 0x3fffffff
	var m1 := m >> 30
	var c0 := m0 * mul_limbs[0]
	var r0 := c0 & 0x3fffffff
	var carry := c0 >> 30

	var c1 := m0 * mul_limbs[1] + m1 * mul_limbs[0] + carry
	var r1 := c1 & 0x3fffffff
	carry = c1 >> 30

	var c2 := m0 * mul_limbs[2] + m1 * mul_limbs[1] + carry
	var r2 := c2 & 0x3fffffff
	carry = c2 >> 30

	var c3 := m0 * mul_limbs[3] + m1 * mul_limbs[2] + carry
	var r3 := c3 & 0x3fffffff
	carry = c3 >> 30

	var c4 := m0 * mul_limbs[4] + m1 * mul_limbs[3] + carry
	var r4 := c4 & 0x3fffffff
	carry = c4 >> 30

	var c5 := m1 * mul_limbs[4] + carry
	var r5 := c5 & 0x3fffffff
	var r6 := c5 >> 30

	# Extract shifted value from 7 limbs of 30 bits (210 bits total).
	var w := j / 30
	var b := j % 30
	var limbs: Array[int] = [r0, r1, r2, r3, r4, r5, r6]
	var res := 0
	var bit_pos := 0
	var idx := w
	if b > 0 and idx < 7:
		res = limbs[idx] >> b
		bit_pos = 30 - b
		idx += 1
	while idx < 7 and bit_pos < 62:
		res |= limbs[idx] << bit_pos
		bit_pos += 30
		idx += 1
	return res

static func _multiple_of_power_of_5(val: int, p: int) -> bool:
	var v := val
	for _k in range(p):
		if v % 5 != 0:
			return false
		v /= 5
	return true

static func _multiple_of_power_of_2(val: int, p: int) -> bool:
	if p == 0:
		return true
	if p >= 63:
		return val == 0
	return (val & ((1 << p) - 1)) == 0

static func _ryu_d2d(x: float) -> Array:
	# Assumes x > 0 and finite. Returns [digits_str: String, exp10: int] where value == int(digits_str) * 10^exp10.
	var bits := float_to_bits(x)
	var ieee_exp := (bits >> 52) & 0x7ff
	var ieee_mant := bits & 0xfffffffffffff
	var e2: int
	var m2: int
	if ieee_exp == 0:
		e2 = 1 - 1023 - 52 - 2
		m2 = ieee_mant
	else:
		e2 = ieee_exp - 1023 - 52 - 2
		m2 = (1 << 52) | ieee_mant

	var even := (m2 & 1) == 0
	var accept_bounds := even

	var mv := 4 * m2
	var mp := mv + 2
	var mm_shift := 1 if (ieee_mant != 0 or ieee_exp <= 1) else 0
	var mm := mv - 1 - mm_shift

	var vr: int
	var vp: int
	var vm: int
	var e10: int
	var vm_is_trailing_zeros := false
	var vr_is_trailing_zeros := false

	if e2 >= 0:
		var q := maxi(0, ((e2 * 78913) >> 18) - 1)
		e10 = q
		var k := DOUBLE_POW5_INV_BITCOUNT + _pow5_bits(q) - 1
		var i := -e2 + q + k
		var inv_limbs := _ryu_inv_split(q)
		vr = _mul_shift_ryu(mv, inv_limbs, i)
		vp = _mul_shift_ryu(mp, inv_limbs, i)
		vm = _mul_shift_ryu(mm, inv_limbs, i)
		if q <= 21:
			if mv % 5 == 0:
				vr_is_trailing_zeros = _multiple_of_power_of_5(mv, q)
			elif accept_bounds:
				vm_is_trailing_zeros = _multiple_of_power_of_5(mm, q)
			else:
				if _multiple_of_power_of_5(mp, q):
					vp -= 1
	else:
		var q := maxi(0, ((-e2 * 732923) >> 20) - 1)
		e10 = q + e2
		var i := -e2 - q
		var k := _pow5_bits(i) - DOUBLE_POW5_BITCOUNT
		var j := q - k
		var pos_limbs := _ryu_pos_split(i)
		vr = _mul_shift_ryu(mv, pos_limbs, j)
		vp = _mul_shift_ryu(mp, pos_limbs, j)
		vm = _mul_shift_ryu(mm, pos_limbs, j)
		if q <= 1:
			vr_is_trailing_zeros = true
			if accept_bounds:
				vm_is_trailing_zeros = (mm_shift == 1)
			else:
				vp -= 1
		elif q < 63:
			vr_is_trailing_zeros = _multiple_of_power_of_2(mv, q - 1)

	var removed := 0
	var last_removed_digit := 0
	var output: int
	if vm_is_trailing_zeros or vr_is_trailing_zeros:
		while true:
			var vp_div10 := vp / 10
			var vm_div10 := vm / 10
			if vp_div10 <= vm_div10:
				break
			var vm_mod10 := vm % 10
			var vr_div10 := vr / 10
			var vr_mod10 := vr % 10
			vm_is_trailing_zeros = vm_is_trailing_zeros and (vm_mod10 == 0)
			vr_is_trailing_zeros = vr_is_trailing_zeros and (last_removed_digit == 0)
			last_removed_digit = vr_mod10
			vr = vr_div10
			vp = vp_div10
			vm = vm_div10
			removed += 1
		if vm_is_trailing_zeros:
			while true:
				var vm_div10 := vm / 10
				var vm_mod10 := vm % 10
				if vm_mod10 != 0:
					break
				var vp_div10 := vp / 10
				var vr_div10 := vr / 10
				var vr_mod10 := vr % 10
				vr_is_trailing_zeros = vr_is_trailing_zeros and (last_removed_digit == 0)
				last_removed_digit = vr_mod10
				vr = vr_div10
				vp = vp_div10
				vm = vm_div10
				removed += 1
		if vr_is_trailing_zeros and last_removed_digit == 5 and vr % 2 == 0:
			last_removed_digit = 4
		var round_up := (vr == vm and (not accept_bounds or not vm_is_trailing_zeros)) or last_removed_digit >= 5
		output = vr + (1 if round_up else 0)
	else:
		var round_up := false
		while true:
			var vp_div10 := vp / 10
			var vm_div10 := vm / 10
			if vp_div10 <= vm_div10:
				break
			var vr_div10 := vr / 10
			var vr_mod10 := vr % 10
			round_up = vr_mod10 >= 5
			vr = vr_div10
			vp = vp_div10
			vm = vm_div10
			removed += 1
		output = vr + (1 if (vr == vm or round_up) else 0)

	var exp10 := e10 + removed
	var s := str(output)
	# Strip any trailing zeros that rounding may have introduced (rare, e.g., 99 -> 100)
	var slen := s.length()
	while slen > 1 and s.unicode_at(slen - 1) == 48:
		slen -= 1
		exp10 += 1
	if slen != s.length():
		s = s.substr(0, slen)
	return [s, exp10]

static func number_to_string(x: float) -> String:
	# ECMAScript Number::toString(x, 10)
	_ensure_init()
	if is_nan(x):
		return "NaN"
	if x == 0.0:
		return "0"
	if is_inf(x):
		return "-Infinity" if x < 0.0 else "Infinity"
	var neg := x < 0.0
	var ax := -x if neg else x
	var prefix := "-" if neg else ""

	# Fast path for exact safe integers <= 2^53 - 1
	if floor(ax) == ax and ax < 9007199254740992.0:
		return prefix + str(int(ax))

	var d := _ryu_d2d(ax)
	var s: String = d[0]
	var exp10: int = d[1]
	var k := s.length()
	var n := exp10 + k # mathematical value is 0.<s> * 10^n

	if k <= n and n <= 21:
		return prefix + s + "0".repeat(n - k)
	if 0 < n and n <= 21:
		return prefix + s.substr(0, n) + "." + s.substr(n)
	if -6 < n and n <= 0:
		return prefix + "0." + "0".repeat(-n) + s
	var e := n - 1
	var esign := "+" if e >= 0 else "-"
	var eabs := str(absi(e))
	if k == 1:
		return prefix + s + "e" + esign + eabs
	return prefix + s.substr(0, 1) + "." + s.substr(1) + "e" + esign + eabs

# ---------------------------------------------------------------- toFixed & toExponential

static func to_fixed(x: float, fraction_digits: int = 0) -> String:
	# ECMAScript Number.prototype.toFixed(fractionDigits), 0 <= f <= 100
	_ensure_init()
	var f := clampi(fraction_digits, 0, 100)
	if is_nan(x):
		return "NaN"
	if is_inf(x):
		return "-Infinity" if x < 0.0 else "Infinity"
	if x == 0.0:
		return "0" if f == 0 else ("0." + "0".repeat(f))
	var neg := x < 0.0
	var ax := -x if neg else x
	var prefix := "-" if neg else ""
	if ax >= 1e21:
		return number_to_string(x)

	# Exact binary value of ax = m2 * 2^e2
	var bits := float_to_bits(ax)
	var ieee_exp := (bits >> 52) & 0x7ff
	var ieee_mant := bits & 0xfffffffffffff
	var m2: int
	var e2: int
	if ieee_exp == 0:
		m2 = ieee_mant
		e2 = 1 - 1023 - 52
	else:
		m2 = (1 << 52) | ieee_mant
		e2 = ieee_exp - 1023 - 52

	# Compute exact rounded integer n = round_half_away(m2 * 2^e2 * 10^f)
	var num := JsBigInt.mul(JsBigInt.from_int(m2), JsBigInt.pow10(f))
	var den := JsBigInt.from_int(1)
	if e2 > 0:
		num = JsBigInt.shl(num, e2)
	elif e2 < 0:
		den = JsBigInt.shl(den, -e2)

	var dm := JsBigInt.divmod(num, den)
	var q: PackedInt64Array = dm[0]
	var rem: PackedInt64Array = dm[1]
	# Tie away from zero: if 2 * rem >= den, round up!
	if JsBigInt.cmp(JsBigInt.shl(rem, 1), den) >= 0:
		q = JsBigInt.add_small(q, 1)

	var m := JsBigInt.to_decimal(q)
	if f == 0:
		return prefix + m
	var k := m.length()
	if k <= f:
		m = "0".repeat(f + 1 - k) + m
		k = f + 1
	return prefix + m.substr(0, k - f) + "." + m.substr(k - f)

static func to_exponential(x: float, fraction_digits: int = -1) -> String:
	# ECMAScript Number.prototype.toExponential(fractionDigits)
	# Pass fraction_digits = -1 for omitted argument.
	_ensure_init()
	if is_nan(x):
		return "NaN"
	if is_inf(x):
		return "-Infinity" if x < 0.0 else "Infinity"
	var neg := x < 0.0
	var ax := -x if neg else x
	var prefix := "-" if neg else ""
	if x == 0.0:
		var f0 := 0 if fraction_digits < 0 else clampi(fraction_digits, 0, 100)
		return ("0" if f0 == 0 else ("0." + "0".repeat(f0))) + "e+0"

	if fraction_digits < 0:
		var d := _ryu_d2d(ax)
		var s: String = d[0]
		var exp10: int = d[1]
		var e := exp10 + s.length() - 1
		var esign := "+" if e >= 0 else "-"
		if s.length() == 1:
			return prefix + s + "e" + esign + str(absi(e))
		return prefix + s.substr(0, 1) + "." + s.substr(1) + "e" + esign + str(absi(e))

	var f := clampi(fraction_digits, 0, 100)
	# Exact binary value of ax = m2 * 2^e2
	var bits := float_to_bits(ax)
	var ieee_exp := (bits >> 52) & 0x7ff
	var ieee_mant := bits & 0xfffffffffffff
	var m2: int
	var e2: int
	if ieee_exp == 0:
		m2 = ieee_mant
		e2 = 1 - 1023 - 52
	else:
		m2 = (1 << 52) | ieee_mant
		e2 = ieee_exp - 1023 - 52

	# Find exact decimal exponent e such that 10^e <= ax < 10^(e+1)
	var ryu := _ryu_d2d(ax)
	var ryu_s: String = ryu[0]
	var ryu_exp: int = ryu[1]
	var e := ryu_exp + ryu_s.length() - 1
	# Verify 10^e <= ax < 10^(e+1) with exact BigInt (handles cases like 9.999...999e-1 vs 1.0)
	var num_base := JsBigInt.from_int(m2)
	# Compare ax with 10^e: ax >= 10^e iff m2 * 2^e2 >= 10^e
	while not _ge_pow10(num_base, e2, e):
		e -= 1
	while _ge_pow10(num_base, e2, e + 1):
		e += 1

	# Now compute n = round_half_away(ax * 10^(f - e))
	var scale10 := f - e
	var num := num_base
	var den := JsBigInt.from_int(1)
	if scale10 > 0:
		num = JsBigInt.mul(num, JsBigInt.pow10(scale10))
	elif scale10 < 0:
		den = JsBigInt.mul(den, JsBigInt.pow10(-scale10))
	if e2 > 0:
		num = JsBigInt.shl(num, e2)
	elif e2 < 0:
		den = JsBigInt.shl(den, -e2)

	var dm := JsBigInt.divmod(num, den)
	var q: PackedInt64Array = dm[0]
	var rem: PackedInt64Array = dm[1]
	if JsBigInt.cmp(JsBigInt.shl(rem, 1), den) >= 0:
		q = JsBigInt.add_small(q, 1)

	var m := JsBigInt.to_decimal(q)
	if m.length() > f + 1:
		# Carry overflowed 10^(f+1)
		e += 1
		m = m.substr(0, f + 1)

	var esign := "+" if e >= 0 else "-"
	if f == 0:
		return prefix + m + "e" + esign + str(absi(e))
	return prefix + m.substr(0, 1) + "." + m.substr(1) + "e" + esign + str(absi(e))

static func _ge_pow10(m2_big: PackedInt64Array, e2: int, exp10: int) -> bool:
	# Returns true iff m2 * 2^e2 >= 10^exp10.
	# Rearrange: m2 * 2^(e2 - exp10) >= 5^exp10
	var lhs := m2_big
	var rhs := JsBigInt.from_int(1)
	if exp10 > 0:
		rhs = JsBigInt.pow5(exp10)
	elif exp10 < 0:
		lhs = JsBigInt.mul(lhs, JsBigInt.pow5(-exp10))
	var shift2 := e2 - exp10
	if shift2 > 0:
		lhs = JsBigInt.shl(lhs, shift2)
	elif shift2 < 0:
		rhs = JsBigInt.shl(rhs, -shift2)
	return JsBigInt.cmp(lhs, rhs) >= 0
