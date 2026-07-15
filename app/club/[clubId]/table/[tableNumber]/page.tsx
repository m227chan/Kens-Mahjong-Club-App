'use client'

import { useParams } from 'next/navigation'
import FocusedTableView from '@/components/FocusedTableView'

export default function FocusedTablePage() {
  const params = useParams<{ clubId: string; tableNumber: string }>()
  return <FocusedTableView clubId={decodeURIComponent(params.clubId ?? '').toUpperCase()} tableNumber={Math.max(1, Number(params.tableNumber) || 1)} />
}
