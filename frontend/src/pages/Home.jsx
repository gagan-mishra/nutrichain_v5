import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout'
import { api } from '../api'
import { useCtx } from '../state/context'

export default function Home() {
  const { firm, fy, setFirm, setFy } = useCtx()
  const [firms, setFirms] = useState([])
  const [fys, setFys] = useState([])
  const [activeKey, setActiveKey] = useState('order-confirm')

  useEffect(() => {
    if (!localStorage.getItem('token')) localStorage.setItem('token', 'dummy') // for demo; real app uses /auth/login
    ;(async () => {
      const { data: firmList } = await api.get('/firms')
      const { data: fyList } = await api.get('/firms/fiscal-years')
      setFirms(firmList); setFys(fyList)
      if (!firm && firmList[0]) setFirm(firmList[0])
      if (!fy && fyList[0]) setFy(fyList[0])
    })()
  }, [])

  return (
    <AppShell
      firm={firm} fy={fy}
      firms={firms} fys={fys}
      setFirm={setFirm} setFy={setFy}
      activeKey={activeKey} setActiveKey={setActiveKey}
    >
      <div className="text-sm text-white/80">
        Go to <a className="underline" href="/sales/order-confirm">Sales → Order Confirm</a>.
      </div>
    </AppShell>
  )
}
