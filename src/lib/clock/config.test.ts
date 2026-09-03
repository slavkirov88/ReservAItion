import { __toConfigForTests as toConfig, assertWritable, type ClockTenantConfig } from './config'

const sandboxUrl = 'https://sky-eu1.clock-software.com/pms_api/176987/16449'

const full = {
  clock: {
    base_url: sandboxUrl,
    api_user: 'staydesk_voice_16449',
    api_key: 'k',
    rate_ids: [799198, 799199],
    room_type_ids: [42414],
  },
}

test('reads a complete clock block', () => {
  const config = toConfig('t1', full)
  expect(config?.creds.apiUser).toBe('staydesk_voice_16449')
  expect(config?.rateIds).toEqual([799198, 799199])
  expect(config?.roomTypeIds).toEqual([42414])
})

test('a tenant without a clock block is simply not connected', () => {
  expect(toConfig('t1', {})).toBeNull()
  expect(toConfig('t1', null)).toBeNull()
})

// A half-filled block is the shape of a mistake mid-setup. Treating it as
// "connected" would send the agent at a PMS it cannot authenticate against,
// in the middle of a call.
test('a partial clock block counts as not connected, not as broken', () => {
  expect(toConfig('t1', { clock: { base_url: sandboxUrl, api_user: 'u' } })).toBeNull()
})

// Going live is a decision someone writes down. A forgotten field must not be
// the thing that lets writes reach a real hotel.
test('sandbox defaults to true when the flag is missing', () => {
  expect(toConfig('t1', full)?.sandbox).toBe(true)
})

test('sandbox is only off when it is explicitly false', () => {
  const live = { clock: { ...full.clock, sandbox: false } }
  expect(toConfig('t1', live)?.sandbox).toBe(false)
})

test('rubbish in rate_ids is dropped rather than trusted', () => {
  const messy = { clock: { ...full.clock, rate_ids: ['799198', null, 'abc'] } }
  expect(toConfig('t1', messy)?.rateIds).toEqual([799198])
})

const base: ClockTenantConfig = {
  tenantId: 't1',
  creds: { baseUrl: sandboxUrl, apiUser: 'u', apiKey: 'k' },
  rateIds: [799198],
  roomTypeIds: [42414],
  sandbox: true,
}

test('a sandbox tenant may be written to on the sandbox host', () => {
  expect(() => assertWritable(base)).not.toThrow()
})

test('a sandbox tenant pointed at another host refuses writes', () => {
  const wrong = { ...base, creds: { ...base.creds, baseUrl: 'https://live.example.com/pms_api/1/2' } }
  expect(() => assertWritable(wrong)).toThrow(/sandbox/i)
})

// Clock refuses a booking without a rate_id and this API user cannot override
// availability, so an empty rate list is a configuration error worth catching
// before a guest is on the phone.
test('no configured rates means no booking', () => {
  expect(() => assertWritable({ ...base, rateIds: [] })).toThrow(/rate_id/)
})
