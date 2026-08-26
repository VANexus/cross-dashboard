"use client";

interface TextBlockProps {
  block: { text: string };
}

export function TextBlock({ block }: TextBlockProps) {
  return (
    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
      {block.text}
    </div>
  );
}
