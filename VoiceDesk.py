import os
import sys
import json
import threading
import mimetypes
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path

from google import genai
from google.genai import types

# -------------------------------------------------------------
# -------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()


class RowItem:
    def __init__(self, filename, time_str, speaker, original, korean):
        self.filename = filename
        self.time = time_str
        self.speaker = speaker
        self.original = original
        self.korean = korean


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("VoiceDesk AI | Gemini 음성 전사·번역")
        self.geometry("1100x760")
        self.minsize(900, 600)
        self.configure(bg="#f4f6fa")

        self.files = []
        self.rows = []
        self.batch_running = False

        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.style.configure(
            "Treeview",
            rowheight=36,
            font=("Malgun Gothic", 10),
            background="white",
            fieldbackground="white",
            borderwidth=0,
        )
        self.style.configure(
            "Treeview.Heading",
            font=("Malgun Gothic", 9, "bold"),
            background="#f0f2f6",
            foreground="#596274",
            relief="flat",
        )
        self.style.configure("TButton", font=("Malgun Gothic", 10), padding=(12, 8))

        self.build()

    def build(self):
        top = tk.Frame(self, bg="white", height=60)
        top.pack(fill="x")
        top.pack_propagate(False)
        tk.Label(
            top,
            text="✨ VoiceDesk AI (Gemini Powered)",
            bg="white",
            fg="#172033",
            font=("Malgun Gothic", 18, "bold"),
        ).pack(side="left", padx=20)
        tk.Label(
            top,
            text="Google Cloud 초고속 AI 처리 · 메모리 부담 제로",
            bg="white",
            fg="#0b57d0",
            font=("Malgun Gothic", 10, "bold"),
        ).pack(side="left", padx=8)

        main = tk.Frame(self, bg="#f4f6fa")
        main.pack(fill="both", expand=True, padx=20, pady=15)

        row = tk.Frame(main, bg="#f4f6fa")
        row.pack(fill="x", pady=10)

        self.drop = tk.Frame(
            row,
            bg="white",
            highlightthickness=1,
            highlightbackground="#dce2ec",
            padx=12,
            pady=8,
        )
        self.drop.pack(side="left", fill="x", expand=True)

        self.file_label = tk.Label(
            self.drop,
            text="음성 파일을 선택해 주세요 (mp3, wav, m4a 등)",
            bg="white",
            fg="#687489",
            font=("Malgun Gothic", 10),
        )
        self.file_label.pack(side="left")

        ttk.Button(self.drop, text="파일 선택", command=self.pick_file).pack(side="right")
        ttk.Button(self.drop, text="목록 비우기", command=self.clear_files).pack(side="right", padx=5)

        toolbar = tk.Frame(main, bg="#f4f6fa")
        toolbar.pack(fill="x", pady=5)

        ttk.Button(
            toolbar,
            text="⚡ Gemini 음성 인식 & 번역 시작",
            command=self.start_transcription,
        ).pack(side="left")
        ttk.Button(toolbar, text="+ 대사 직접 추가", command=self.add_row).pack(side="left", padx=5)
        ttk.Button(toolbar, text="내보내기 (TXT/CSV)", command=self.export).pack(side="right")

        self.status = tk.StringVar(value="준비됨")
        tk.Label(
            toolbar,
            textvariable=self.status,
            bg="#f4f6fa",
            fg="#687489",
            font=("Malgun Gothic", 9),
        ).pack(side="right", padx=10)

        card = tk.Frame(
            main,
            bg="white",
            highlightthickness=1,
            highlightbackground="#e3e8f0",
        )
        card.pack(fill="both", expand=True, pady=5)

        cols = ("num", "file", "time", "speaker", "original", "korean")
        self.tree = ttk.Treeview(card, columns=cols, show="headings", selectmode="browse")

        headers = [
            ("num", "#", 40, "center"),
            ("file", "파일명", 140, "w"),
            ("time", "시간", 110, "center"),
            ("speaker", "화자", 80, "center"),
            ("original", "원문", 360, "w"),
            ("korean", "한국어 번역", 360, "w"),
        ]
        for c, title, width, anchor in headers:
            self.tree.heading(c, text=title)
            self.tree.column(c, width=width, anchor=anchor, stretch=c in ("original", "korean"))

        sb = ttk.Scrollbar(card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

    def pick_file(self):
        paths = filedialog.askopenfilenames(
            title="음성 파일 선택",
            filetypes=[("음성 파일", "*.mp3 *.wav *.m4a *.aac *.flac *.ogg")],
        )
        if paths:
            self.files = list(paths)
            self.file_label.config(
                text=f"{len(self.files)}개 파일 선택됨: {Path(self.files[0]).name} 외"
            )
            self.status.set(f"{len(self.files)}개 파일 대기 중")

    def clear_files(self):
        self.files.clear()
        self.rows.clear()
        self.tree.delete(*self.tree.get_children())
        self.file_label.config(text="음성 파일을 선택해 주세요")
        self.status.set("초기화됨")

    def add_row(self):
        item = RowItem("-", "00:00 - 00:00", "화자 1", "직접 입력 원문", "직접 입력 번역")
        self.rows.append(item)
        idx = len(self.rows)
        self.tree.insert(
            "",
            "end",
            values=(
                idx,
                item.filename,
                item.time,
                item.speaker,
                item.original,
                item.korean,
            ),
        )

    def start_transcription(self):
        if not self.files:
            messagebox.showwarning("파일 없음", "먼저 음성 파일을 선택해 주세요.")
            return
        if not GEMINI_API_KEY or "발급받은" in GEMINI_API_KEY:
            messagebox.showerror("API 키 필요", "GEMINI_API_KEY 환경 변수에 발급받으신 키를 설정하고 프로그램을 다시 실행해 주세요.")
            return
        if self.batch_running:
            return

        self.batch_running = True
        self.rows.clear()
        self.tree.delete(*self.tree.get_children())
        self.status.set("Gemini AI 서버와 통신 중...")

        threading.Thread(target=self.worker_gemini, daemon=True).start()

    def worker_gemini(self):
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)

            for f_idx, file_path in enumerate(self.files, 1):
                p = Path(file_path)

                mime_type, _ = mimetypes.guess_type(str(p))
                if not mime_type:
                    mime_type = "audio/mp3"

                with open(p, "rb") as f:
                    audio_bytes = f.read()

                prompt = """
                당신은 전문 음성 전사 및 번역가입니다.
                제공된 음성 파일을 분석하여 다음 JSON 포맷 배열로만 응답해 주세요:
                [
                  {
                    "time": "시작초-종료초 (예: 00:01 - 00:05)",
                    "speaker": "화자 1 (또는 식별된 이름)",
                    "original": "음성 원문 텍스트",
                    "korean": "자연스러운 한국어 번역문 (원문이 이미 한국어라면 정돈된 원문)"
                  }
                ]
                다른 설명 없이 순수 JSON 리스트만 출력하세요. 마크다운 ```json 태그도 제외하고 순수 JSON만 출력하세요.
                """

                # 트래픽 분산 및 과부하 우회 후보 목록
                candidate_models = [
                    "gemini-3.5-flash-lite",
                    "gemini-3.8-flash",
                ]
                response = None
                last_err = None

                for target_model in candidate_models:
                    try:
                        self.after(
                            0,
                            self.status.set,
                            f"[{f_idx}/{len(self.files)}] {target_model} 모델로 분석 중...",
                        )
                        response = client.models.generate_content(
                            model=target_model,
                            contents=[
                                types.Part.from_bytes(
                                    data=audio_bytes, mime_type=mime_type
                                ),
                                prompt,
                            ],
                        )
                        if response and response.text:
                            break
                    except Exception as err:
                        last_err = err
                        if "503" in str(err) or "404" in str(err):
                            continue
                        else:
                            raise err

                if not response:
                    raise last_err

                text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
                items = json.loads(text)

                for item in items:
                    row = RowItem(
                        p.name,
                        item.get("time", "-"),
                        item.get("speaker", "화자"),
                        item.get("original", ""),
                        item.get("korean", ""),
                    )
                    self.rows.append(row)
                    idx = len(self.rows)
                    self.after(
                        0,
                        self.tree.insert,
                        "",
                        "end",
                        None,
                        (
                            idx,
                            row.filename,
                            row.time,
                            row.speaker,
                            row.original,
                            row.korean,
                        ),
                    )

            self.after(0, self.status.set, f"완료됨! 총 {len(self.rows)}개 대사 변환 완료")
            messagebox.showinfo("성공", "Gemini 음성 분석 및 번역이 완료되었습니다!")

        except Exception as e:
            self.after(0, self.status.set, "오류 발생")
            messagebox.showerror("처리 오류", f"오류 내용:\n{str(e)}")
        finally:
            self.batch_running = False

    def export(self):
        if not self.rows:
            messagebox.showwarning("대사 없음", "내보낼 데이터가 없습니다.")
            return

        save_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV 파일", "*.csv"), ("텍스트 파일", "*.txt")],
        )
        if save_path:
            with open(save_path, "w", encoding="utf-8-sig") as f:
                f.write("번호,파일명,시간,화자,원문,한국어 번역\n")
                for i, r in enumerate(self.rows, 1):
                    clean_orig = r.original.replace('"', '""')
                    clean_kor = r.korean.replace('"', '""')
                    f.write(
                        f'{i},"{r.filename}","{r.time}","{r.speaker}","{clean_orig}","{clean_kor}"\n'
                    )
            messagebox.showinfo("저장 완료", "성공적으로 저장되었습니다!")


if __name__ == "__main__":
    app = App()
    app.mainloop()
