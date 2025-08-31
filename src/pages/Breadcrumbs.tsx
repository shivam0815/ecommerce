import React from "react";
import { Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

type Crumb = {
  label: string;
  to?: string; // omit for the current/active page
};

type Props = {
  items: Crumb[];
  className?: string;
};

const CrumbSeparator = () => (
  <ChevronRight className="mx-1 h-4 w-4 text-gray-400" aria-hidden="true" />
);

export default function Breadcrumbs({ items, className = "" }: Props) {
  if (!items?.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-6 ${className}`}
    >
      {/* Accessible + SEO friendly structure */}
      <ol
        className="flex items-center flex-wrap gap-1 text-sm"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const content = (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                isLast
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              itemProp="name"
              title={item.label}
            >
              {i === 0 && <Home className="h-4 w-4" aria-hidden="true" />}
              <span
                className={isLast ? "truncate max-w-[60vw] md:max-w-none" : ""}
              >
                {item.label}
              </span>
            </span>
          );

          const node = item.to && !isLast ? (
            <Link to={item.to} itemProp="item">
              {content}
            </Link>
          ) : (
            // Current page: no link, but keep microdata wrapper
            <span itemProp="item">{content}</span>
          );

          return (
            <li
              key={`${item.label}-${i}`}
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {node}
              <meta itemProp="position" content={String(i + 1)} />
              {!isLast && <CrumbSeparator />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
