export const memoryStages = [
  { label: '访问', event: 'ACCESS REQUESTED', status: '访问虚拟页', present: false },
  { label: '缺页', event: 'PAGE FAULT', status: '页尚未驻留，等待处理', present: false },
  { label: '就绪', event: 'FRAME ALLOCATED', status: '物理页就绪，等待更新映射', present: false },
  { label: '映射', event: 'MAPPING UPDATED', status: '映射已建立', present: true },
  { label: '继续', event: 'EXECUTION RESUMED', status: '访问继续，偏移保持不变', present: true },
] as const

// One illustrative recoverable demand-paging fault, with 4 KiB pages.
// Virtual page 04 and physical frame 07 deliberately have different indices.
export const memory = { vpn: 4, pfn: 7, pageSize: 4096, offset: 0x02a }
export const hex = (value: number, width = 2) => `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
export const virtualAddress = hex(memory.vpn * memory.pageSize + memory.offset, 6)
export const physicalAddress = hex(memory.pfn * memory.pageSize + memory.offset, 6)
