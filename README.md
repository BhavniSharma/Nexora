# ☁️ Nexora — Cloud Incident Intelligence & Reliability Platform

\<p align="center">
&#x20; \<strong>Monitor. Detect. Diagnose. Recover.\</strong>
\</p>

\<p align="center">
&#x20; An AWS-focused cloud monitoring and incident intelligence platform designed to improve infrastructure visibility, detect abnormal behaviour, and support faster incident response.
\</p>

---

## Overview

**Nexora** is a Cloud & DevOps major project that focuses on infrastructure monitoring, incident detection, and cloud reliability.

It brings AWS infrastructure metrics, monitoring insights, incident history, and diagnostic capabilities together in a unified dashboard.

The platform uses Python, FastAPI, Boto3, AWS CloudWatch, and React to connect cloud infrastructure with an intelligent monitoring interface.

The goal is to move beyond basic infrastructure monitoring towards a system that can identify abnormal resource behaviour, help investigate incidents, and eventually support controlled remediation.

## Key Features

- **AWS Infrastructure Monitoring:** Retrieve EC2-related infrastructure information and CloudWatch metrics.
- **Resource Utilization:** Visualize CPU, memory, and disk utilization through dedicated monitoring charts.
- **Incident Management:** Track active incidents and maintain incident history.
- **Anomaly Detection:** Analyse metric patterns using statistical anomaly detection techniques.
- **Incident Diagnosis:** Generate diagnostic insights to help investigate infrastructure issues.
- **Metric Health Tracking:** Identify fresh, stale, and unavailable metric samples.
- **Multi-Instance Dashboard:** View infrastructure information through an instance selector and consolidated dashboard.
- **Remediation Workflow:** Includes APIs for remediation recommendations and incident resolution.
- **Monitoring Dashboard:** View infrastructure status, metrics, and incident information in one place.

## Architecture

```text
                 AWS CLOUD
                     |
          +----------+----------+
          |                     |
       Amazon EC2          CloudWatch
          |                     |
          +----------+----------+
                     |
                 Boto3
                     |
              FastAPI Backend
                     |
          +----------+----------+
          |          |          |
       Metrics    Incidents  Intelligence
          |          |          |
          +----------+----------+
                     |
               SQLite Database
                     |
                REST APIs
                     |
              React Frontend
                     |
             Nexora Dashboard
```

## Technology Stack

| Category          | Technologies                                |
| ----------------- | ------------------------------------------- |
| Frontend          | React.js, Vite, JavaScript, CSS             |
| Backend           | Python, FastAPI                             |
| Cloud Platform    | Amazon Web Services                         |
| AWS Integration   | Boto3                                       |
| Monitoring        | Amazon CloudWatch, CloudWatch Agent         |
| Infrastructure    | Amazon EC2, S3, IAM, VPC                    |
| Database          | SQLite                                      |
| Machine Learning  | Scikit-learn, statistical anomaly detection |
| Development Tools | VS Code, Git, GitHub, AWS CLI               |

## Core Monitoring Workflow

Nexora is designed around the following reliability workflow:

1. **Monitor:** Collect infrastructure metrics from AWS resources.
2. **Detect:** Identify abnormal resource utilization and potential incidents.
3. **Diagnose:** Analyse available metrics and incident evidence.
4. **Recommend:** Generate possible remediation recommendations.
5. **Recover:** Support incident resolution and track the outcome.

## Project Structure

```text
Nexora/
│
├── backend/
│   └── app/
│       ├── api/
│       ├── services/
│       └── main.py
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── services/
│       └── App.jsx
│
├── infrastructure/
├── ml/
├── monitoring/
├── remediation/
├── tests/
│
├── requirements.txt
└── README.md
```

*The structure above represents the main project areas; individual files may evolve during development.*

## Getting Started

### Prerequisites

- Python 3.11 or a compatible project-supported version
- Node.js and npm
- AWS account with access to EC2 and CloudWatch
- AWS CLI
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/BhavniSharma/Nexora.git
cd Nexora
```

### 2. Set Up the Backend

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
```

Install the project's Python dependencies using its requirements file:

```powershell
pip install -r requirements.txt
```

If the requirements file is located in the project root instead, use:

```powershell
pip install -r ..\requirements.txt
```

### 3. Configure AWS Credentials

Nexora uses Boto3 to communicate with AWS services.

Configure credentials through an AWS CLI profile, environment variables, or an IAM role.

For temporary AWS credentials in PowerShell:

```powershell
$env:AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
$env:AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY"
$env:AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN"
$env:AWS_DEFAULT_REGION="ap-south-1"
```

Verify the AWS connection:

```powershell
aws sts get-caller-identity
```

Never commit AWS credentials or session tokens to GitHub.

### 4. Start the Backend

From the backend directory:

```powershell
python -m uvicorn app.main:app --reload --port 8003
```

Backend API:

```text
http://127.0.0.1:8003
```

Interactive API documentation:

```text
http://127.0.0.1:8003/docs
```

### 5. Start the Frontend

Open another terminal:

```powershell
cd frontend

npm install

npm run dev
```

Frontend:

```text
http://localhost:5173
```

Make sure the frontend API configuration points to the running backend.

## AWS Configuration

Nexora requires appropriate AWS permissions to retrieve infrastructure information and monitoring metrics.

Core permissions include:

- `ec2:DescribeRegions`
- `ec2:DescribeInstances`
- `cloudwatch:GetMetricStatistics`
- `cloudwatch:GetMetricData`
- `sts:GetCallerIdentity`

For memory and disk monitoring, install and configure the **Amazon CloudWatch Agent** on the monitored EC2 instances and publish the required metrics to the `CWAgent` namespace.

Actual metric availability depends on AWS configuration, instance state, agent installation, and permissions.

## Current Development Status

| Component                                | Status                                     |
| ---------------------------------------- | ------------------------------------------ |
| React monitoring dashboard               | Implemented                                |
| FastAPI backend                          | Implemented                                |
| EC2-related APIs                         | Implemented                                |
| CloudWatch integration                   | Implemented; live AWS verification ongoing |
| Incident history and APIs                | Implemented                                |
| Statistical anomaly detection            | Implemented                                |
| Rule-based diagnosis                     | Implemented                                |
| Dynamic multi-region EC2 discovery       | In progress                                |
| CloudWatch Agent memory/disk integration | Configuration and verification ongoing     |
| Automated remediation execution          | Future development                         |
| Recovery verification                    | Future development                         |

## Future Roadmap

- Complete automatic EC2 discovery across all enabled AWS regions.
- Improve real-time infrastructure monitoring and metric collection.
- Integrate CloudWatch Agent metrics for memory and disk.
- Strengthen anomaly detection using machine learning.
- Develop controlled automated remediation workflows.
- Add post-remediation health verification.
- Expand infrastructure observability and incident reporting.
- Improve deployment automation and CI/CD integration.

## Project Objective

The long-term vision of Nexora is to create an intelligent cloud reliability platform that reduces manual infrastructure monitoring, improves incident visibility, and helps engineers respond to infrastructure problems more effectively.

---

## Author

**Bhavni Sharma**
B.Tech — Computer Science & Engineering
Lovely Professional University

GitHub: [BhavniSharma](https://github.com/BhavniSharma)

**Project:** Nexora — Cloud Incident Intelligence & Reliability Platform

---

\<p align="center">   \<strong>Built with Python, React & AWS ☁️\</strong> \</p>
