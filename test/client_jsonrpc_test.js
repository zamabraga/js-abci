const assert = require('assert')
const axios = require('axios')
const makeRequest = params =>
  axios({
    method: 'post',
    url: 'http://localhost:46657',
    data: {
      method: 'status',
      jsonrpc: '2.0',
      params: params || {},
      id: 'dontcare'
    }
  })
describe('JSONRPC', () => {
  const tests = [
    { method: 'abci_info' },
    { method: 'dump_consensus_state' },
    { method: 'genesis' },
    { method: 'net_info' },
    { method: 'num_unconfirmed_txs' },
    { method: 'status' },
    { method: 'unconfirmed_txs' },
    { method: 'unsafe_flush_mempool' },
    { method: 'unsafe_stop_cpu_profiler' },
    { method: 'validators' },
    { method: 'abci_query' },
    { method: 'block' },
    { method: 'blockchain' },
    { method: 'broadcast_tx_async' },
    { method: 'broadcast_tx_commit' },
    { method: 'broadcast_tx_sync' },
    { method: 'commit' },
    { method: 'dial_seeds' },
    { method: 'subscribe' },
    { method: 'tx' },
    { method: 'unsafe_start_cpu_profiler' },
    { method: 'unsafe_write_heap_profile' },
    { method: 'unsubscribe' }
  ]

  describe('#over HTTP', () => {
    tests.forEach(t => {
      it(`shoud request method ${t.method}`, async () => {
        const { data } = await makeRequest('teste')
        const { jsonrpc, id } = data
        assert.equal(jsonrpc, '2.0')
        assert.equal(id, 'dontcare')
      })
    })
  })
})
