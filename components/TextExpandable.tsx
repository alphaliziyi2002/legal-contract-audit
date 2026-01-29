import React, { useState, useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TextExpandableProps {
  /** 要显示的内容 */
  children: React.ReactNode;
  /** 缩略显示的最大长度（字符） */
  maxLength?: number;
  /** 展开按钮文本 */
  expandText?: string;
  /** 收起按钮文本 */
  collapseText?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 内容容器自定义类名 */
  contentClassName?: string;
  /** 按钮自定义类名 */
  buttonClassName?: string;
  /** 过渡动画持续时间（毫秒） */
  transitionDuration?: number;
}

/**
 * 文本展开/收起组件
 * 支持富文本内容、平滑过渡效果和自定义配置
 */
export default function TextExpandable({
  children,
  maxLength = 200,
  expandText = '展开',
  collapseText = '收起',
  defaultExpanded = false,
  className = '',
  contentClassName = '',
  buttonClassName = '',
  transitionDuration = 300,
}: TextExpandableProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [text, setText] = useState<string>('');
  const [isLongText, setIsLongText] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 提取文本内容
  useEffect(() => {
    // 使用防抖处理，避免频繁计算
    const timer = setTimeout(() => {
      if (typeof children === 'string') {
        setText(children);
        setIsLongText(children.length > maxLength);
      } else {
        try {
          // 对于富文本内容，创建临时元素来获取文本长度
          const tempElement = document.createElement('div');
          tempElement.innerHTML = ReactDOMServer.renderToString(React.createElement('div', null, children));
          const plainText = tempElement.textContent || '';
          setText(plainText);
          setIsLongText(plainText.length > maxLength);
        } catch (error) {
          console.error('Error extracting text content:', error);
          // 降级处理
          setText('');
          setIsLongText(false);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [children, maxLength]);

  // 切换展开/收起状态
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // 渲染缩略文本
  const renderTruncatedText = () => {
    if (typeof children === 'string') {
      return (
        <>
          {text.substring(0, maxLength)}
          <span className="text-gray-500">...</span>
        </>
      );
    }
    return children;
  };

  // 计算过渡样式
  const transitionStyle = {
    transition: `all ${transitionDuration}ms ease-in-out`,
    overflow: 'hidden',
  };

  return (
    <div className={`text-expandable ${className}`}>
      {/* 内容容器 */}
      <div
        ref={contentRef}
        className={`text-expandable-content ${contentClassName}`}
        style={{
          ...transitionStyle,
          // 动态调整高度
          height: expanded ? 'auto' : 'auto',
        }}
      >
        {/* 条件渲染内容 */}
        {isLongText ? (
          expanded ? (
            // 展开状态：显示完整内容
            <div className="whitespace-pre-wrap leading-relaxed">
              {children}
            </div>
          ) : (
            // 收起状态：显示缩略内容
            <div className="whitespace-pre-wrap leading-relaxed">
              {renderTruncatedText()}
            </div>
          )
        ) : (
          // 文本长度不超过阈值，直接显示完整内容
          <div className="whitespace-pre-wrap leading-relaxed">
            {children}
          </div>
        )}
      </div>

      {/* 展开/收起按钮 */}
      {isLongText && (
        <button
          onClick={toggleExpanded}
          className={`text-expandable-button mt-2 inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors ${buttonClassName}`}
          aria-expanded={expanded}
          aria-label={expanded ? collapseText : expandText}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1 transition-transform" />
              {collapseText}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1 transition-transform" />
              {expandText}
            </>
          )}
        </button>
      )}
    </div>
  );
}
