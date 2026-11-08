import { BlockList, isIP } from 'node:net'

/** Networks that aren't the public internet: this machine, private and shared ranges, link-local, documentation… */
const PRIVATE = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6')
}

/** The IPv4 address inside an IPv4-mapped IPv6 one (::ffff:127.0.0.1 or ::ffff:7f00:1), else the address itself. */
function unmapped(address: string) {
  const mapped = address.match(/^::ffff:(?:0:)?(.+)$/i)?.[1]
  if (!mapped) return address
  if (isIP(mapped) === 4) return mapped
  const hex = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!hex) return address
  const value = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16)
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.')
}

/** Whether an IP address is inside a private network (or this machine); anything that isn't an IP counts as private. */
export function isPrivateAddress(address: string) {
  const plain = unmapped(address.replace(/^\[|\]$/g, '').replace(/%.*$/, ''))
  const family = isIP(plain)
  if (!family) return true
  return PRIVATE.check(plain, family === 4 ? 'ipv4' : 'ipv6')
}
