class_name JsBigInt
extends RefCounted

# Unsigned arbitrary-precision integer in base 2^30 (little-endian limbs).
# All arithmetic stays strictly below 2^60, so signed 64-bit GDScript int never overflows.

const BASE: int = 1073741824 # 1 << 30
const BASE_MASK: int = 1073741823 # (1 << 30) - 1
const BASE_BITS: int = 30

static var _pow5_cache: Array = []

static func trim(a: PackedInt64Array) -> PackedInt64Array:
	var n := a.size()
	while n > 0 and a[n - 1] == 0:
		n -= 1
	if n != a.size():
		a.resize(n)
	return a

static func zero() -> PackedInt64Array:
	return PackedInt64Array()

static func from_int(v: int) -> PackedInt64Array:
	if v <= 0:
		return PackedInt64Array()
	var out := PackedInt64Array()
	var x := v
	while x > 0:
		out.append(x & BASE_MASK)
		x >>= BASE_BITS
	return out

static func from_u64(hi32: int, lo32: int) -> PackedInt64Array:
	# Construct from two unsigned 32-bit halves (both in 0..0xffffffff).
	var out := PackedInt64Array()
	var b0 := lo32 & BASE_MASK
	var b1 := ((lo32 >> 30) & 3) | ((hi32 & 0x0fffffff) << 2)
	var b2 := (hi32 >> 28) & 0xf
	if b2 != 0:
		out.resize(3)
		out[0] = b0
		out[1] = b1
		out[2] = b2
	elif b1 != 0:
		out.resize(2)
		out[0] = b0
		out[1] = b1
	elif b0 != 0:
		out.resize(1)
		out[0] = b0
	return out

static func from_decimal(digits: String) -> PackedInt64Array:
	var out := PackedInt64Array()
	var n := digits.length()
	var i := 0
	while i < n and digits.unicode_at(i) == 48: # '0'
		i += 1
	while i < n:
		var chunk_len := mini(9, n - i)
		var chunk_val := 0
		var mult := 1
		for j in range(chunk_len):
			chunk_val = chunk_val * 10 + (digits.unicode_at(i + j) - 48)
			mult *= 10
		out = mul_small(out, mult)
		if chunk_val > 0:
			out = add_small(out, chunk_val)
		i += chunk_len
	return out

static func to_decimal(a: PackedInt64Array) -> String:
	if a.is_empty():
		return "0"
	var cur := a.duplicate()
	var chunks: Array[String] = []
	while not cur.is_empty():
		var dm := divmod_small(cur, 1000000000)
		cur = dm[0]
		var rem: int = dm[1]
		if cur.is_empty():
			chunks.append(str(rem))
		else:
			chunks.append("%09d" % rem)
	chunks.reverse()
	return "".join(chunks)

static func is_zero(a: PackedInt64Array) -> bool:
	return a.is_empty()

static func cmp(a: PackedInt64Array, b: PackedInt64Array) -> int:
	var na := a.size()
	var nb := b.size()
	if na != nb:
		return 1 if na > nb else -1
	for i in range(na - 1, -1, -1):
		if a[i] != b[i]:
			return 1 if a[i] > b[i] else -1
	return 0

static func bit_length(a: PackedInt64Array) -> int:
	var n := a.size()
	if n == 0:
		return 0
	var top := a[n - 1]
	var bits := (n - 1) * BASE_BITS
	while top > 0:
		bits += 1
		top >>= 1
	return bits

static func add_small(a: PackedInt64Array, v: int) -> PackedInt64Array:
	if v == 0:
		return a.duplicate()
	var out := a.duplicate()
	var carry := v
	var i := 0
	while carry > 0:
		if i < out.size():
			var s := out[i] + carry
			out[i] = s & BASE_MASK
			carry = s >> BASE_BITS
		else:
			out.append(carry & BASE_MASK)
			carry >>= BASE_BITS
		i += 1
	return out

static func add(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	var na := a.size()
	var nb := b.size()
	var n := maxi(na, nb)
	var out := PackedInt64Array()
	out.resize(n)
	var carry := 0
	for i in range(n):
		var s := carry + (a[i] if i < na else 0) + (b[i] if i < nb else 0)
		out[i] = s & BASE_MASK
		carry = s >> BASE_BITS
	if carry > 0:
		out.append(carry)
	return trim(out)

static func sub(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	# Assumes a >= b.
	var na := a.size()
	var nb := b.size()
	var out := PackedInt64Array()
	out.resize(na)
	var borrow := 0
	for i in range(na):
		var diff := a[i] - (b[i] if i < nb else 0) - borrow
		if diff < 0:
			diff += BASE
			borrow = 1
		else:
			borrow = 0
		out[i] = diff
	return trim(out)

static func mul_small(a: PackedInt64Array, m: int) -> PackedInt64Array:
	if a.is_empty() or m == 0:
		return PackedInt64Array()
	if m == 1:
		return a.duplicate()
	var n := a.size()
	var out := PackedInt64Array()
	out.resize(n)
	var carry := 0
	for i in range(n):
		var prod := a[i] * m + carry
		out[i] = prod & BASE_MASK
		carry = prod >> BASE_BITS
	while carry > 0:
		out.append(carry & BASE_MASK)
		carry >>= BASE_BITS
	return trim(out)

static func mul(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	var na := a.size()
	var nb := b.size()
	if na == 0 or nb == 0:
		return PackedInt64Array()
	var out := PackedInt64Array()
	out.resize(na + nb)
	for i in range(na + nb):
		out[i] = 0
	for i in range(na):
		var ai := a[i]
		if ai == 0:
			continue
		var carry := 0
		for j in range(nb):
			var idx := i + j
			var prod := out[idx] + ai * b[j] + carry
			out[idx] = prod & BASE_MASK
			carry = prod >> BASE_BITS
		var k := i + nb
		while carry > 0:
			var s := out[k] + carry
			out[k] = s & BASE_MASK
			carry = s >> BASE_BITS
			k += 1
	return trim(out)

static func shl(a: PackedInt64Array, shift: int) -> PackedInt64Array:
	if a.is_empty() or shift <= 0:
		return a.duplicate()
	var word_shift := shift / BASE_BITS
	var bit_shift := shift % BASE_BITS
	var na := a.size()
	var out := PackedInt64Array()
	out.resize(na + word_shift + (1 if bit_shift > 0 else 0))
	for i in range(word_shift):
		out[i] = 0
	if bit_shift == 0:
		for i in range(na):
			out[i + word_shift] = a[i]
	else:
		var carry := 0
		var inv_shift := BASE_BITS - bit_shift
		for i in range(na):
			var v := a[i]
			out[i + word_shift] = ((v << bit_shift) & BASE_MASK) | carry
			carry = v >> inv_shift
		out[na + word_shift] = carry
	return trim(out)

static func shr(a: PackedInt64Array, shift: int) -> PackedInt64Array:
	if a.is_empty() or shift <= 0:
		return a.duplicate()
	var word_shift := shift / BASE_BITS
	var bit_shift := shift % BASE_BITS
	var na := a.size()
	if word_shift >= na:
		return PackedInt64Array()
	var out_len := na - word_shift
	var out := PackedInt64Array()
	out.resize(out_len)
	if bit_shift == 0:
		for i in range(out_len):
			out[i] = a[i + word_shift]
	else:
		var inv_shift := BASE_BITS - bit_shift
		for i in range(out_len):
			var lo := a[i + word_shift] >> bit_shift
			var hi := ((a[i + word_shift + 1] << inv_shift) & BASE_MASK) if (i + word_shift + 1 < na) else 0
			out[i] = lo | hi
	return trim(out)

static func divmod_small(a: PackedInt64Array, d: int) -> Array:
	# 1 <= d < 2^30. Returns [quotient: PackedInt64Array, remainder: int].
	var n := a.size()
	if n == 0:
		return [PackedInt64Array(), 0]
	var q := PackedInt64Array()
	q.resize(n)
	var rem := 0
	for i in range(n - 1, -1, -1):
		var cur := (rem << BASE_BITS) | a[i]
		q[i] = cur / d
		rem = cur % d
	return [trim(q), rem]

static func divmod(a: PackedInt64Array, b: PackedInt64Array) -> Array:
	# General unsigned division via Knuth-style / shift-normalized division.
	# Returns [quotient: PackedInt64Array, remainder: PackedInt64Array].
	if b.is_empty():
		push_error("JsBigInt.divmod: division by zero")
		return [PackedInt64Array(), PackedInt64Array()]
	var c := cmp(a, b)
	if c < 0:
		return [PackedInt64Array(), a.duplicate()]
	if c == 0:
		return [from_int(1), PackedInt64Array()]
	if b.size() == 1:
		var dm := divmod_small(a, b[0])
		return [dm[0], from_int(dm[1])]

	# Fast Knuth Algorithm D in base 2^30.
	var n := b.size()
	var m := a.size() - n
	# Normalize so top limb of b has MSB at bit 29 (>= BASE / 2).
	var top_b := b[n - 1]
	var norm_shift := 0
	while (top_b << norm_shift) < (BASE >> 1):
		norm_shift += 1
	var u := shl(a, norm_shift)
	var v := shl(b, norm_shift)
	if u.size() <= m + n:
		u.resize(m + n + 1)
	var q := PackedInt64Array()
	q.resize(m + 1)
	var vn1 := v[n - 1]
	var vn2 := v[n - 2]

	for j in range(m, -1, -1):
		var u2 := (u[j + n] << BASE_BITS) | u[j + n - 1]
		var qhat := u2 / vn1
		var rhat := u2 % vn1
		if qhat >= BASE:
			qhat = BASE - 1
			rhat = u2 - qhat * vn1
		while rhat < BASE and qhat * vn2 > ((rhat << BASE_BITS) | u[j + n - 2]):
			qhat -= 1
			rhat += vn1
		# Multiply and subtract qhat * v from u[j .. j+n].
		var carry := 0
		var borrow := 0
		for i in range(n):
			var p := qhat * v[i] + carry
			carry = p >> BASE_BITS
			var sub_val := (p & BASE_MASK) + borrow
			var diff := u[j + i] - sub_val
			if diff < 0:
				var k := (-diff + BASE - 1) / BASE
				diff += k * BASE
				borrow = k
			else:
				borrow = 0
			u[j + i] = diff
		var final_diff := u[j + n] - carry - borrow
		if final_diff < 0:
			# qhat was 1 too large; add back v.
			qhat -= 1
			var add_carry := 0
			for i in range(n):
				var s := u[j + i] + v[i] + add_carry
				u[j + i] = s & BASE_MASK
				add_carry = s >> BASE_BITS
			u[j + n] = final_diff + add_carry
		else:
			u[j + n] = final_diff
		q[j] = qhat

	u.resize(n)
	var rem := shr(trim(u), norm_shift)
	return [trim(q), rem]

static func pow5(e: int) -> PackedInt64Array:
	if _pow5_cache.is_empty():
		_pow5_cache.append(from_int(1))
	while _pow5_cache.size() <= e:
		var prev: PackedInt64Array = _pow5_cache[_pow5_cache.size() - 1]
		_pow5_cache.append(mul_small(prev, 5))
	return _pow5_cache[e]

static func pow10(e: int) -> PackedInt64Array:
	return shl(pow5(e), e)

static func to_u64_pair(a: PackedInt64Array) -> Array[int]:
	# Returns [hi32, lo32] for values < 2^64.
	var b0 := a[0] if a.size() > 0 else 0
	var b1 := a[1] if a.size() > 1 else 0
	var b2 := a[2] if a.size() > 2 else 0
	var lo32 := b0 | ((b1 & 3) << 30)
	var hi32 := (b1 >> 2) | (b2 << 28)
	return [hi32 & 0xffffffff, lo32 & 0xffffffff]
