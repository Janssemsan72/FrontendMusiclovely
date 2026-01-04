import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      offset="60px"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg !py-2 !px-3 !text-sm !min-h-[auto] !max-w-[320px]",
          description: "group-[.toast]:text-muted-foreground !text-xs !mt-0.5",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !h-6 !text-xs !px-2",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground !h-6 !text-xs !px-2",
          title: "!text-sm !font-medium !leading-tight",
        },
        style: {
          padding: "8px 12px",
          fontSize: "14px",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
