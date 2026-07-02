# CollabCode Classroom

<p align="center">
  <img src="images/icon.png" width="140" alt="CollabCode Classroom Logo"/>
</p>

<h1 align="center">CollabCode Classroom</h1>

<p align="center">
  <strong>Real-time classroom coding support directly inside Visual Studio Code.</strong>
</p>

<p align="center">
  Empowering educators and students with seamless live collaboration, private assistance, and classroom management.
</p>

<p align="center">
  <a href="https://collabcode-dashboard.vercel.app"><strong>🌐 Website</strong></a> •
  <a href="https://github.com/Nitesh-N-D/CollabCode"><strong>GitHub</strong></a> •
  <a href="https://github.com/Nitesh-N-D/CollabCode/issues"><strong>Report Issues</strong></a>
</p>

---

# 📖 Overview

**CollabCode Classroom** is a Visual Studio Code extension designed for modern programming classrooms.

It enables students to connect directly with instructors, collaborate in real time, and receive private coding assistance without leaving the editor.

Whether you're teaching in a university, bootcamp, or online coding class, CollabCode streamlines classroom communication and coding support.

---

# ✨ Features

## 🚀 Join Classroom

Connect securely to instructor-created classroom sessions.

---

## 💻 Real-Time Collaboration

Synchronize coding activities with your classroom in real time using Socket.IO.

---

## 🙋 Private Help Requests

Need assistance?

Students can privately notify instructors without interrupting the class.

---

## 📤 Export Coding Sessions

Export your coding session for:

- Assignment submissions
- Portfolio projects
- Code review
- Personal revision

---

## ⚡ Lightweight & Fast

- Minimal CPU usage
- Fast synchronization
- Optimized for VS Code
- Non-intrusive background operation

---

# 🛠 Commands

| Command | Description |
|---------|-------------|
| **CollabCode: Join Classroom** | Join a classroom session |
| **CollabCode: Leave Classroom** | Leave the current classroom |
| **CollabCode: Request Help Privately** | Notify the instructor privately |
| **CollabCode: Export My Session** | Export the current coding session |

---

# ⚙️ Extension Settings

### Server URL

```text
collabcode.serverUrl
```

Default:

```text
https://collabcode-api-w9km.onrender.com
```

---

### Display Name

```text
collabcode.displayName
```

The name displayed to instructors.

---

### Snapshot Interval

```text
collabcode.snapshotIntervalMs
```

Default:

```text
2000 ms
```

Determines how frequently editor snapshots are synchronized.

---

# 🚀 Getting Started

## 1. Install

Install **CollabCode Classroom** from the Visual Studio Marketplace.

---

## 2. Configure

Open **Settings**

Search for

```text
CollabCode
```

Configure:

- Server URL
- Display Name

---

## 3. Join a Classroom

Open the Command Palette

```text
Ctrl + Shift + P
```

Run

```text
CollabCode: Join Classroom
```

Enter the classroom details provided by your instructor.

---

# 🏗 Architecture

```text
          Student VS Code Extension
                     │
                     │
                Socket.IO
                     │
                     ▼
        CollabCode Backend Server
                     │
                     ▼
        Instructor Dashboard (React)
```

---

# 💻 Technology Stack

- TypeScript
- VS Code Extension API
- Socket.IO
- Node.js
- Express.js
- React
- Vite

---

# 📅 Roadmap

Planned features include:

- 🤖 AI Coding Assistant
- 📊 Classroom Analytics
- ⏪ Session Replay
- 🎥 Session Recording
- 👨‍🏫 Multi-Classroom Support
- 📝 Code Review Mode
- 📚 Assignment Tracking
- 🔔 Classroom Notifications

---

# 🤝 Contributing

Contributions are welcome!

If you'd like to improve CollabCode:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

Bug reports and feature requests are always appreciated.

---

# 🔗 Resources

### 🌐 Website

https://collabcode-dashboard.vercel.app

### 📦 Repository

https://github.com/Nitesh-N-D/CollabCode

### 🐞 Report Issues

https://github.com/Nitesh-N-D/CollabCode/issues

---

# 📄 License

This project is licensed under the **MIT License**.

See the LICENSE file for details.

---

# ❤️ Developed By

**Nitesh N.D**

Madras Institute of Technology (MIT), Anna University

GitHub: https://github.com/Nitesh-N-D

---

<p align="center">
  <strong>Made with ❤️ to improve programming education.</strong>
</p>