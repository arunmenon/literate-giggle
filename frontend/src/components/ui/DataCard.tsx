import React from "react";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";

export interface DataCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const DataCard: React.FC<DataCardProps> = ({
  title,
  description,
  icon,
  action,
  children,
  className,
  contentClassName,
}) => {
  return (
    <Card
      className={cn(
        "animate-fade-in transition-all duration-200 hover:shadow-lg",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              {icon}
            </div>
          )}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
};

export { DataCard };
