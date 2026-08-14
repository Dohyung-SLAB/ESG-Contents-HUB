import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageHeaderProps = {
  title: string;
  description: string;
  badge?: string;
};

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-[var(--brand-ink)]">
          {title}
        </h1>
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {badge ? <Badge variant="outline">{badge}</Badge> : null}
    </div>
  );
}

type PlaceholderCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PlaceholderCard({
  title,
  description,
  children,
}: PlaceholderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
