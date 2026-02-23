import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaginationControlsProps {
  /** Current page (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total item count (for the "Showing X–Y of Z" label) */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Called when the user clicks a page */
  onPageChange: (page: number) => void;
  /** Called when the user changes page size */
  onPageSizeChange?: (size: number) => void;
  /** Available page sizes */
  pageSizeOptions?: number[];
}

/**
 * Reusable pagination bar with page numbers, prev/next, page-size selector,
 * and a "Showing X–Y of Z" label.
 */
export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationControlsProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  /** Build an array of page numbers to show, with ellipsis gaps. */
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5; // max page buttons to show (excluding ellipsis)

    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) pages.push('ellipsis');

      for (let i = start; i <= end; i++) pages.push(i);

      if (end < totalPages - 1) pages.push('ellipsis');

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      {/* Left: Showing X–Y of Z */}
      <p className="text-sm text-muted-foreground shrink-0 order-2 sm:order-1">
        Showing{' '}
        <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span>
      </p>

      {/* Center: Page numbers */}
      {totalPages > 1 && (
        <Pagination className="order-1 sm:order-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>

            {/* Page numbers – hidden on very small screens */}
            <span className="hidden xs:contents sm:contents">
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === currentPage}
                      onClick={() => onPageChange(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
            </span>

            {/* On very small screens just show "Page X of Y" */}
            <span className="xs:hidden sm:hidden text-sm text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>

            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Right: Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2 order-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
