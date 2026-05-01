export default function ExplorePage() {
  return (
    <div className="flex h-full overflow-hidden">

      {/* Left — patterns */}
      <div className="flex-1 overflow-y-auto px-7 py-[26px] border-r border-charcoal/8 dark:border-white/[0.07] min-w-0">

        <div className="mb-[22px]">
          <div className="font-serif text-[20px] font-light text-charcoal dark:text-[#f0ede8] mb-1">Your mind, explored</div>
          <div className="text-[12px] text-charcoal/40 dark:text-[#5c5a57]">
            Patterns and connections across everything you have captured
          </div>
        </div>

        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] p-[18px] mb-[14px]">
          <div className="font-serif text-[16px] font-light text-charcoal dark:text-[#f0ede8] mb-[3px]">Recurring themes</div>
          <div className="text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-3">
            What your mind keeps returning to across all projects
          </div>
          <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
            Themes appear as your corpus grows.
          </p>
        </div>

        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] p-[18px]">
          <div className="font-serif text-[16px] font-light text-charcoal dark:text-[#f0ede8] mb-[3px]">Questions you keep raising</div>
          <div className="text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-3">
            Open questions surfaced across your captures
          </div>
          <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
            Questions emerge as Ki processes your captures.
          </p>
        </div>

      </div>

      {/* Right — Ki corpus chat */}
      <div className="w-[350px] shrink-0 bg-charcoal/[0.02] dark:bg-[#161514] border-l border-charcoal/8 dark:border-white/[0.07] flex flex-col">

        <div className="px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">Chat with Ki</div>
            <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57] mt-[1px]">full corpus in context</div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-charcoal/40 dark:text-[#5c5a57] bg-charcoal/[0.04] dark:bg-[#1d1b1a] px-[9px] py-[3px] rounded-full border border-charcoal/8 dark:border-white/[0.07]">
            <span className="w-[5px] h-[5px] rounded-full bg-sage" />
            all captures
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-[9px]">
          <div className="self-start max-w-full">
            <div className="bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] rounded-tl-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed">
              Your full corpus is loaded. Ask me anything about what you have been thinking,
              what patterns I notice, or what you seem most uncertain about. I only know what
              you have given me.
            </div>
            <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-[2px] px-[3px]">Ki · ready</div>
          </div>
        </div>

        <div className="px-3 py-[10px] border-t border-charcoal/8 dark:border-white/[0.07] shrink-0">
          <div className="flex gap-[5px] flex-wrap mb-[7px]">
            {[
              'what am I most focused on?',
              'what patterns do you see?',
              'what am I avoiding?',
            ].map((s) => (
              <button
                key={s}
                className="text-[10px] px-[9px] py-[3px] border border-charcoal/8 dark:border-white/[0.07] rounded-full text-charcoal/40 dark:text-[#5c5a57] bg-transparent cursor-pointer hover:border-terra hover:text-terra hover:bg-terra/10 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-[7px] bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[9px] py-[7px] focus-within:border-charcoal/15 dark:focus-within:border-white/[0.13] transition-colors">
            <textarea
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-charcoal dark:text-[#f0ede8] font-sans resize-none min-h-5 max-h-[70px] leading-[1.5] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic"
              placeholder="Ask Ki anything across all captures..."
              rows={1}
            />
            <button className="w-[26px] h-[26px] rounded-[7px] bg-terra border-none text-white text-[12px] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#b83333] transition-colors">
              ↑
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
