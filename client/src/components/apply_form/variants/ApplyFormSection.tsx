import { Card, CardContent } from "@/components/ui/card";
import { LeadForm, type LeadFormData } from "@/components/LeadForm";

interface ApplyFormSectionData {
  type: "apply_form";
  version: string;
  hero: {
    title: string;
    subtitle: string;
    note?: string;
  };
  form: LeadFormData;
  next_steps: {
    title: string;
    items: Array<{
      title: string;
      description: string;
    }>;
    closing: string;
  };
}

interface ApplyFormSectionProps {
  data: ApplyFormSectionData;
  landingLocations?: string[];
}

export function ApplyFormSection({ data, landingLocations }: ApplyFormSectionProps) {
  return (
    <section className="bg-background" data-testid="section-apply-form">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <Card className="border shadow-sm" data-testid="card-apply-form">
              <CardContent className="p-6">
                <LeadForm data={data.form} landingLocations={landingLocations} />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-0 bg-muted/30" data-testid="card-next-steps">
              <CardContent className="p-6 md:p-8">
                <h2 
                  className="text-2xl font-bold text-foreground mb-6"
                  data-testid="text-next-steps-title"
                >
                  {data.next_steps.title}
                </h2>
                
                <div className="space-y-4">
                  {data.next_steps.items.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex gap-4"
                      data-testid={`next-step-${index}`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-foreground">
                          <span className="font-semibold">{item.title}:</span>{" "}
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p 
                  className="mt-6 text-lg font-semibold text-primary"
                  data-testid="text-closing"
                >
                  {data.next_steps.closing}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ApplyFormSection;
