const SkeletonProductCard = () => {
  return (
    <div className="animate-pulse w-full">
      <div className="aspect-square w-full rounded-[1.75rem] sm:rounded-[2rem] bg-brand-light" />
      <div className="mt-4 px-1 flex flex-col gap-2">
        <div className="h-3 w-1/3 bg-brand-light rounded" />
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-4 w-2/3 bg-brand-light rounded" />
          <div className="h-4 w-12 bg-brand-light rounded" />
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="h-5 w-5 rounded-md bg-brand-light" />
          <div className="h-5 w-5 rounded-md bg-brand-light" />
          <div className="h-5 w-5 rounded-md bg-brand-light" />
        </div>
      </div>
    </div>
  )
}

export default SkeletonProductCard
