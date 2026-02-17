import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useInternalNav } from "@/hooks/useInternalNav";
import {
  IconBrandLinkedin,
  IconBrandFacebook,
  IconBrandX,
  IconBrandInstagram,
} from "@tabler/icons-react";
import logo from "@assets/4geeks-devs-logo_1763162063433.png";

interface FooterColumn {
  title: string;
  items: { label: string; href: string }[];
}

interface FooterSocial {
  name: string;
  icon: string;
  link: string;
}

interface FooterLegalLink {
  label: string;
  href: string;
}

interface FooterConfig {
  columns: FooterColumn[];
  socials: FooterSocial[];
  legal_links: FooterLegalLink[];
  copyright_text: string;
  subscribe_text: string
}

const socialIconMap: Record<string, typeof IconBrandLinkedin> = {
  linkedin: IconBrandLinkedin,
  facebook: IconBrandFacebook,
  "x-logo": IconBrandX,
  instagram: IconBrandInstagram,
};

export default function Footer() {
  const handleLinkClick = useInternalNav();
  const { i18n } = useTranslation();
  const locale = i18n.language || "en";

  const { data: menuResponse } = useQuery<{
    name: string;
    data: { footer: FooterConfig };
  }>({
    queryKey: ["/api/menus", "main-footer", locale],
    queryFn: async () => {
      const response = await fetch(`/api/menus/main-footer?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load footer menu");
      return response.json();
    },
  });

  const config = menuResponse?.data?.footer;
  if (!config) return null;

  const currentYear = new Date().getFullYear();
  const defaultCopyrightText =
    config.copyright_text?.replace(/\d{4}/, String(currentYear)) ||
    `${currentYear} 4Geeks Academy`;
  const copyrightText = config.copyright_text || defaultCopyrightText

  return (
    <footer className="text-foreground" data-testid="section-global-footer">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="lg:shrink-0 flex justify-between items-center h-full mb-8">
          <a
            href="/"
            onClick={handleLinkClick}
            className="flex items-center h-full"
            data-testid="link-footer-home"
          >
            <img src={logo} alt="4Geeks Academy" className="h-9" />
          </a>
          <div>
            <p className="text-center mb-1">{config.subscribe_text || 'Subscribe for more'}</p>
            <div
              className="flex items-center justify-center gap-3"
              data-testid="footer-socials"
            >
              {config.socials?.map((social) => {
                const Icon = socialIconMap[social.icon];
                if (!Icon) return null;
                return (
                  <a
                    key={social.name}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                    data-testid={`link-social-${social.icon}`}
                    aria-label={social.name}
                  >
                    <Icon className="h-6 w-6" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-row lg:justify-between gap-8 lg:gap-4">
          {config.columns?.map((column) => {
            const itemCount = column.items?.length || 0;
            const subCols = Math.ceil(itemCount / 5);

            return (
              <div
                key={column.title}
                data-testid={`footer-column-${column.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  {column.title}
                </h3>
                <ul
                  className="gap-x-8"
                  style={{
                    columnCount: subCols,
                    columnGap: "2rem",
                  }}
                >
                  {column.items?.map((item, itemIdx) => {
                    const isExternal = item.href.startsWith("http");
                    return (
                      <li
                        key={`${item.label}-${itemIdx}`}
                        className="mb-2.5 break-inside-avoid"
                      >
                        <a
                          href={item.href}
                          onClick={isExternal ? undefined : handleLinkClick}
                          target={isExternal ? "_blank" : undefined}
                          rel={isExternal ? "noopener noreferrer" : undefined}
                          className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                          data-testid={`link-footer-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-8 border-t border-background/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p
              className="text-sm text-foreground/60"
              data-testid="text-copyright"
            >
              {copyrightText}
            </p>
            <div
              className="flex items-center gap-6 flex-wrap"
              data-testid="footer-legal-links"
            >
              {config.legal_links?.map((link) => {
                const isExternal = link.href.startsWith("http");
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={isExternal ? undefined : handleLinkClick}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="text-sm text-foreground/60 hover:text-foreground transition-colors"
                    data-testid={`link-legal-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
