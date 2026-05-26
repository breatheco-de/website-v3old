import { useQuery } from "@tanstack/react-query";
import { IconCreditCard, IconStar } from "@tabler/icons-react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface EcommercePlan {
  plan_id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: "monthly" | "annual" | "one_time";
  highlighted: boolean;
  badge?: string;
  trial_days?: number;
  features: string[];
}

interface EcommerceProduct {
  product_id: string;
  name: string;
  content_type: string;
  content_slug: string;
  plans: EcommercePlan[];
  active: boolean;
}

interface EcommerceResponse {
  products: EcommerceProduct[];
  settings: {
    currency: string;
    locale: string;
    tax_inclusive: boolean;
  };
}

function formatPrice(price: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

function formatBillingPeriod(period: EcommercePlan["billing_period"]): string {
  switch (period) {
    case "monthly":
      return "/ month";
    case "annual":
      return "/ year";
    case "one_time":
      return "one-time";
    default:
      return period;
  }
}

function PlanSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

export default function StorePlansPage() {
  const { data, isLoading, isError } = useQuery<EcommerceResponse>({
    queryKey: ["/api/ecommerce/products"],
  });

  const locale = data?.settings?.locale ?? "en-US";

  const allPlans: Array<EcommercePlan & { _productNames: string[] }> = [];
  if (data?.products) {
    const planProductMap = new Map<string, string[]>();
    for (const product of data.products) {
      for (const plan of product.plans) {
        if (!planProductMap.has(plan.plan_id)) {
          planProductMap.set(plan.plan_id, []);
          allPlans.push({ ...plan, _productNames: [] });
        }
        planProductMap.get(plan.plan_id)!.push(product.name);
      }
    }
    for (const plan of allPlans) {
      plan._productNames = planProductMap.get(plan.plan_id) ?? [];
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/private/store/products">
            <button
              className="p-1.5 rounded-md hover-elevate"
              data-testid="button-back"
              title="Back to Products"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <IconCreditCard className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold" data-testid="heading-plans">
              Plans
            </h1>
          </div>
          {!isLoading && (
            <Badge variant="secondary" data-testid="badge-plan-count">
              {allPlans.length}
            </Badge>
          )}
        </div>

        {isError && (
          <Card data-testid="error-state">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Failed to load plans. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-3" data-testid="loading-skeleton">
            <PlanSkeleton />
            <PlanSkeleton />
            <PlanSkeleton />
          </div>
        )}

        {!isLoading && !isError && allPlans.length === 0 && (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              <IconCreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No plans found</p>
              <p className="text-xs text-muted-foreground">
                Define plans in{" "}
                <code className="bg-muted px-1 rounded">ecommerce-settings.yml</code> and
                reference them from product entries.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && allPlans.length > 0 && (
          <div className="space-y-3" data-testid="plan-list">
            {allPlans.map((plan) => (
              <Card key={plan.plan_id} data-testid={`card-plan-${plan.plan_id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base" data-testid={`text-plan-name-${plan.plan_id}`}>
                          {plan.name}
                        </CardTitle>
                        {plan.highlighted && (
                          <IconStar
                            className="h-4 w-4 text-yellow-500"
                            data-testid={`icon-plan-highlighted-${plan.plan_id}`}
                            title="Highlighted plan"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono" data-testid={`text-plan-id-${plan.plan_id}`}>
                        {plan.plan_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {plan.badge && (
                        <Badge variant="secondary" data-testid={`badge-plan-badge-${plan.plan_id}`}>
                          {plan.badge}
                        </Badge>
                      )}
                      <span
                        className="text-sm font-semibold"
                        data-testid={`text-plan-price-${plan.plan_id}`}
                      >
                        {formatPrice(plan.price, plan.currency, locale)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatBillingPeriod(plan.billing_period)}
                        </span>
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span data-testid={`text-plan-billing-${plan.plan_id}`}>
                      <span className="font-medium text-foreground">Billing:</span>{" "}
                      {plan.billing_period}
                    </span>
                    <span data-testid={`text-plan-currency-${plan.plan_id}`}>
                      <span className="font-medium text-foreground">Currency:</span>{" "}
                      {plan.currency}
                    </span>
                    {plan.trial_days !== undefined && (
                      <span data-testid={`text-plan-trial-${plan.plan_id}`}>
                        <span className="font-medium text-foreground">Trial:</span>{" "}
                        {plan.trial_days} days
                      </span>
                    )}
                  </div>
                  {plan._productNames.length > 0 && (
                    <div className="text-xs text-muted-foreground" data-testid={`text-plan-products-${plan.plan_id}`}>
                      <span className="font-medium text-foreground">Used by:</span>{" "}
                      {plan._productNames.join(", ")}
                    </div>
                  )}
                  {plan.features.length > 0 && (
                    <ul className="space-y-0.5 pt-1" data-testid={`list-plan-features-${plan.plan_id}`}>
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-0.5 text-foreground">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
