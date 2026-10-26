import type { PurchaseRequest } from '@/types'
import { formatDateTime } from '@/lib/format'

function escapeXml(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cell(value: string | number | null | undefined, type: 'String' | 'Number' = 'String') {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`
}

export function exportPurchaseRequestsToExcel(requests: PurchaseRequest[], filename?: string) {
  const headers = [
    'No',
    'Nomor Referensi',
    'Tanggal',
    'Pemesan',
    'Jenis Pemesanan',
    'Deskripsi',
    'Brand / Katalog',
    'Jumlah',
    'Alasan',
    'Status',
    'Catatan Internal',
    'Lampiran',
    'Diperbarui',
  ]

  const headerRow = headers
    .map(
      (header) =>
        `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`,
    )
    .join('')

  const rows = requests
    .map((pr, index) => {
      const attachments = (pr.attachments ?? [])
        .map((item) => `${item.attachment_type === 'spv_approval' ? 'SPV' : 'Penawaran'}: ${item.original_name}`)
        .join(' | ')
      const orderType =
        pr.order_type === 'Lain-Lain' && pr.custom_order_type
          ? `Lain-Lain - ${pr.custom_order_type}`
          : pr.order_type

      return `<Row>${[
        cell(index + 1, 'Number'),
        cell(pr.reference_number),
        cell(formatDateTime(pr.created_at)),
        cell(pr.requester_name),
        cell(orderType),
        cell(pr.description),
        cell(pr.brand_catalog),
        cell(pr.quantity, 'Number'),
        cell(pr.reason),
        cell(pr.status),
        cell(pr.internal_notes ?? ''),
        cell(attachments),
        cell(formatDateTime(pr.updated_at)),
      ].join('')}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="header">
      <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Purchase Requests">
    <Table>
      <Column ss:Width="40"/>
      <Column ss:Width="130"/>
      <Column ss:Width="120"/>
      <Column ss:Width="140"/>
      <Column ss:Width="150"/>
      <Column ss:Width="260"/>
      <Column ss:Width="160"/>
      <Column ss:Width="60"/>
      <Column ss:Width="240"/>
      <Column ss:Width="90"/>
      <Column ss:Width="200"/>
      <Column ss:Width="200"/>
      <Column ss:Width="120"/>
      <Row ss:Height="24">${headerRow}</Row>
      ${rows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? `purchase-requests-${new Date().toISOString().slice(0, 10)}.xls`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
