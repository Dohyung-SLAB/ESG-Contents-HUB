export function UpdatePlaceholder({ blockId }: { blockId?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {blockId
        ? `콘텐츠 블록 ${blockId}의 연간 업데이트 폼이 여기에 표시됩니다.`
        : "연간 업데이트 대상 콘텐츠 목록이 여기에 표시됩니다."}
    </p>
  );
}
