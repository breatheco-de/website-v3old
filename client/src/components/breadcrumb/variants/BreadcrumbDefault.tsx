import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbItemData {
  label: string;
  url?: string;
}

interface BreadcrumbDefaultProps {
  data: {
    items: BreadcrumbItemData[];
  };
}

export default function BreadcrumbDefault({ data }: BreadcrumbDefaultProps) {
  const { items = [] } = data;

  if (!items.length) return null;

  const nodes: React.ReactNode[] = [];

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;

    nodes.push(
      <BreadcrumbItem key={`item-${index}`}>
        {isLast || !item.url ? (
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink href={item.url}>{item.label}</BreadcrumbLink>
        )}
      </BreadcrumbItem>
    );

    if (!isLast) {
      nodes.push(<BreadcrumbSeparator key={`sep-${index}`} />);
    }
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>{nodes}</BreadcrumbList>
    </Breadcrumb>
  );
}
