import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * PageHeader — 全站统一页头
 *
 * 收敛审计报告中的 4 套并存页头（dash-pagehead 26px / 迷你头 h-8 / text-2xl / font-heading）
 * 为单一视觉层级：mono 面包屑 + 26px 主标题 + 可选的描述与操作区。
 * 所有样式来自 app/globals.css 的 .dash-pagehead 系令牌类，页面不再内联任何页头样式。
 */
export interface PageHeaderProps {
  title: React.ReactNode
  /** 面包屑，如 <><span>工作流</span> / <b>选品工作流</b></> */
  breadcrumb?: React.ReactNode
  description?: React.ReactNode
  /** 标题左侧图标，传入已设好尺寸的图标元素（如 <Wand2 className="h-6 w-6" />） */
  icon?: React.ReactNode
  /** 页头右侧操作区（按钮等） */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  breadcrumb,
  description,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("dash-pagehead", className)}>
      <div className="min-w-0">
        {breadcrumb ? <div className="dash-crumbs">{breadcrumb}</div> : null}
        <h1 className="flex flex-wrap items-center gap-2.5">
          {icon ? <span className="flex shrink-0 items-center text-primary">{icon}</span> : null}
          {title}
        </h1>
        {description ? <p className="dash-desc">{description}</p> : null}
      </div>
      {actions ? <div className="dash-actions">{actions}</div> : null}
    </div>
  )
}
