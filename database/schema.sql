/* =====================================================================
   ProjectFlow - Azure SQL schema
   Run once against an empty database (portal Query editor, Azure Data
   Studio / VS Code mssql extension, or `npm run db:migrate` in /api).
   Safe to re-run: objects are dropped and recreated (DATA IS LOST).
   ===================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('dbo.ScheduleEntries', 'U') IS NOT NULL DROP TABLE dbo.ScheduleEntries;
IF OBJECT_ID('dbo.Tasks', 'U')           IS NOT NULL DROP TABLE dbo.Tasks;
IF OBJECT_ID('dbo.Projects', 'U')        IS NOT NULL DROP TABLE dbo.Projects;
IF OBJECT_ID('dbo.Workers', 'U')         IS NOT NULL DROP TABLE dbo.Workers;

/* ---------- Workers: the people who can be scheduled ---------- */
CREATE TABLE dbo.Workers (
    WorkerId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Workers PRIMARY KEY,
    FirstName   NVARCHAR(100)     NOT NULL,
    LastName    NVARCHAR(100)     NOT NULL,
    Email       NVARCHAR(255)     NOT NULL CONSTRAINT UQ_Workers_Email UNIQUE,
    Role        NVARCHAR(100)     NOT NULL,
    HourlyRate  DECIMAL(10,2)     NULL CONSTRAINT CK_Workers_Rate CHECK (HourlyRate IS NULL OR HourlyRate >= 0),
    IsActive    BIT               NOT NULL CONSTRAINT DF_Workers_IsActive DEFAULT (1),
    CreatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Workers_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Workers_UpdatedAt DEFAULT (SYSUTCDATETIME())
);

/* ---------- Projects ---------- */
CREATE TABLE dbo.Projects (
    ProjectId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Projects PRIMARY KEY,
    Name        NVARCHAR(200)     NOT NULL,
    Description NVARCHAR(2000)    NULL,
    Status      NVARCHAR(20)      NOT NULL CONSTRAINT DF_Projects_Status DEFAULT (N'Planned')
                CONSTRAINT CK_Projects_Status CHECK (Status IN (N'Planned', N'Active', N'OnHold', N'Completed')),
    StartDate   DATE              NULL,
    EndDate     DATE              NULL,
    Budget      DECIMAL(12,2)     NULL CONSTRAINT CK_Projects_Budget CHECK (Budget IS NULL OR Budget >= 0),
    Color       CHAR(7)           NOT NULL CONSTRAINT DF_Projects_Color DEFAULT ('#4F46E5'),
    CreatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Projects_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Projects_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Projects_Dates CHECK (EndDate IS NULL OR StartDate IS NULL OR EndDate >= StartDate)
);

/* ---------- Tasks: belong to exactly one project ---------- */
CREATE TABLE dbo.Tasks (
    TaskId          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tasks PRIMARY KEY,
    ProjectId       INT               NOT NULL,
    Title           NVARCHAR(200)     NOT NULL,
    Description     NVARCHAR(2000)    NULL,
    Status          NVARCHAR(20)      NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT (N'Todo')
                    CONSTRAINT CK_Tasks_Status CHECK (Status IN (N'Todo', N'InProgress', N'Blocked', N'Done')),
    Priority        NVARCHAR(20)      NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT (N'Medium')
                    CONSTRAINT CK_Tasks_Priority CHECK (Priority IN (N'Low', N'Medium', N'High', N'Critical')),
    EstimatedHours  DECIMAL(6,2)      NULL CONSTRAINT CK_Tasks_Hours CHECK (EstimatedHours IS NULL OR EstimatedHours >= 0),
    DueDate         DATE              NULL,
    CreatedAt       DATETIME2(0)      NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(0)      NOT NULL CONSTRAINT DF_Tasks_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Tasks_Projects FOREIGN KEY (ProjectId) REFERENCES dbo.Projects (ProjectId) ON DELETE CASCADE
);
CREATE INDEX IX_Tasks_ProjectId ON dbo.Tasks (ProjectId);


/* ---------- ScheduleEntries: who works on which project/task, and when ----------
   TaskId is optional (general project time). Foreign keys use NO ACTION
   because SQL Server forbids multiple cascade paths; the API deletes
   dependent schedule rows inside a transaction instead.                      */
CREATE TABLE dbo.ScheduleEntries (
    ScheduleId  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ScheduleEntries PRIMARY KEY,
    WorkerId    INT               NOT NULL,
    ProjectId   INT               NOT NULL,
    TaskId      INT               NULL,
    StartTime   DATETIME2(0)      NOT NULL,
    EndTime     DATETIME2(0)      NOT NULL,
    Notes       NVARCHAR(1000)    NULL,
    CreatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Schedule_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt   DATETIME2(0)      NOT NULL CONSTRAINT DF_Schedule_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Schedule_Times CHECK (EndTime > StartTime),
    CONSTRAINT FK_Schedule_Workers  FOREIGN KEY (WorkerId)  REFERENCES dbo.Workers (WorkerId),
    CONSTRAINT FK_Schedule_Projects FOREIGN KEY (ProjectId) REFERENCES dbo.Projects (ProjectId),
    CONSTRAINT FK_Schedule_Tasks    FOREIGN KEY (TaskId)    REFERENCES dbo.Tasks (TaskId)
);
CREATE INDEX IX_Schedule_Worker_Time ON dbo.ScheduleEntries (WorkerId, StartTime, EndTime);
CREATE INDEX IX_Schedule_Project     ON dbo.ScheduleEntries (ProjectId);
CREATE INDEX IX_Schedule_Task        ON dbo.ScheduleEntries (TaskId);
CREATE INDEX IX_Schedule_StartTime   ON dbo.ScheduleEntries (StartTime);


PRINT 'ProjectFlow schema created.';
