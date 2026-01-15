import html2canvas from 'html2canvas';

/**
 * Export the graph as a PNG image
 */
export async function exportGraphAsPNG(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2, // Higher quality
    });

    // Create download link
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Failed to export graph:', error);
    throw error;
  }
}

/**
 * Export data as CSV
 */
export function exportAsCSV(
  data: Array<Record<string, unknown>>,
  filename: string
): void {
  if (data.length === 0) {
    return;
  }

  // Get headers from first row
  const headers = Object.keys(data[0]);

  // Build CSV content
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      // Quote strings that contain commas or quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  // Create download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
