# Smart Fold (VS Code Extension) 📦💻💬

A custom VS Code decorator extension designed to solve the visual clutter in large, legacy codebases. It gives you a bird's-eye "Map View" of your files by allowing you to independently toggle the visibility of code and human-readable comments.

## 🚀 Why I Built This? (The Smart Workflow)

Let's be brutally honest. Hand-writing every single line of code is becoming a thing of the past. Today, we can use AI to write clean, structured, and heavily commented code. But as professional developers working in corporate environments, we still have to survive in massive, messy, legacy codebases where progress often slows to a turtle's pace.

I figured out a smart survival tactic for this chaos: When I am assigned a task on a massive, messy file, I create my own branch, feed that spaghetti code to AI, and ask it to generate structured, human-readable comments to explain the logic.

Now, this AI-commented code is a lifesaver. But here is the catch: having detailed explanations mixed with hundreds of lines of code makes the screen look completely cluttered and messy all over again.

That is exactly the problem **Smart Fold** solves. It lets you separate the human language from the machine language on the fly:
* Want to read the AI's explanation? Hide the code.
* Ready to write your own logic? Hide the comments.
* Want a structural overview? Trigger the **Clean Slate**. It hides absolutely everything, leaving only distinct emojis behind to show you exactly where the code (`💻`) and comments (`💬`) live.

I initially started this using an existing extension (*Inline Fold*). It worked perfectly for just hiding and showing comments. But as my idea grew into hiding the code itself and creating a full 'Clean Slate' view, the tool hit its absolute limit. Since it was the only extension that made even the first part possible, I realized the only way to bring the full vision to life was to build my own.

That is why I decided to build this extension from the ground up.

## ✨ Features & View Modes

Instead of scrolling through thousands of lines, use these modes to focus only on what matters:

* 📦 **Clean Slate (Map View):** Hides everything. Gives you a structural, distraction-free map of the entire file.
* 💬 **Reading Mode (Comments Only):** Hides all code. Perfect for reading documentation, AI-generated notes, and understanding the logic flow.
* 💻 **Coding Mode (Code Only):** Hides all comments. Perfect for pure, focused coding.
* 🖱️ **Sticky Unfold (Auto-Reveal):** Click anywhere on a folded line (emoji) to instantly unfold and read it.
* 🚥 **Status Bar Indicator:** Always know which mode is active with a handy indicator in the VS Code status bar.

## ⌨️ Default Shortcuts

* `Alt + Z` : Clean Slate (Hides both Code and Comments)
* `Alt + X` : Reading Mode (Shows Comments, Hides Code)
* `Alt + C` : Coding Mode (Shows Code, Hides Comments)
* `Alt + S` : Toggle Current Line (Manually pack/unpack the line under your cursor)