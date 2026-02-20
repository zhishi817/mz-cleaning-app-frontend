export type Contact = {
  id: string
  name: string
  mobileAu: string
  department: string
  title: string
}

export const contacts: Contact[] = [
  { id: 'c1', name: 'Alice Wang', mobileAu: '0412 345 678', department: 'Cleaning', title: 'Cleaner' },
  { id: 'c2', name: 'Bob Chen', mobileAu: '0422 111 222', department: 'Customer Success', title: 'CS' },
  { id: 'c3', name: 'Cindy Li', mobileAu: '0433 222 333', department: 'Operations', title: 'Ops' },
  { id: 'c4', name: 'David Zhang', mobileAu: '0444 333 444', department: 'Maintenance', title: 'Handyman' },
  { id: 'c5', name: 'Emily Zhou', mobileAu: '0455 444 555', department: 'Finance', title: 'Accountant' },
  { id: 'c6', name: 'Frank Liu', mobileAu: '0466 555 666', department: 'Front Desk', title: 'Reception' },
  { id: 'c7', name: 'Grace Hu', mobileAu: '0477 666 777', department: 'Cleaning', title: 'Supervisor' },
  { id: 'c8', name: 'Henry Sun', mobileAu: '0488 777 888', department: 'Operations', title: 'Coordinator' },
  { id: 'c9', name: 'Ivy Gao', mobileAu: '0499 888 999', department: 'Customer Success', title: 'CS' },
]

