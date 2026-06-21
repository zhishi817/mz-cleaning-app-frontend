import { companyContentBody, companyContentSummary, parseCompanyContentBlocks } from './companyContent'

test('parses legacy announcement text into headings, paragraphs, and lists', () => {
  const content = [
    '使用 App 的公告',
    '从下周一开始，线下清洁和检查工作将正式使用我们自己的 App 进行操作。',
    '1. 关于照片上传',
    '之前一直没有强制要求大家拍照，但这并不代表拍照属于额外工作。',
    '2. 关于消耗品填写',
    '请清洁人员特别注意:',
    '*清洁人员需要自行返回补充;',
    '*如果类似情况多次发生，后续产生的额外补充成本和时间成本，将由相关责任人承担。',
  ].join('\n')

  const { blocks } = parseCompanyContentBlocks(content)

  expect(blocks).toEqual([
    { type: 'paragraph', text: '使用 App 的公告\n从下周一开始，线下清洁和检查工作将正式使用我们自己的 App 进行操作。' },
    { type: 'heading', level: 2, text: '关于照片上传' },
    { type: 'paragraph', text: '之前一直没有强制要求大家拍照，但这并不代表拍照属于额外工作。' },
    { type: 'heading', level: 2, text: '关于消耗品填写' },
    { type: 'callout', text: '请清洁人员特别注意:' },
    {
      type: 'list',
      ordered: false,
      items: [
        '清洁人员需要自行返回补充;',
        '如果类似情况多次发生，后续产生的额外补充成本和时间成本，将由相关责任人承担。',
      ],
    },
  ])
  expect(companyContentBody(content)).toContain('关于照片上传')
  expect(companyContentSummary(content, '公司公告')).toContain('使用 App 的公告')
})

