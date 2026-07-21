# Section 7: Studies with Independent Entity

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

## 7.1 Objective and Scope

This section includes the complementary studies required to adapt the Tessellum project to the legal, regulatory, and operational requirements that are not fully covered in the preceding sections of the UNE 157801 documentation set.

In UNE-style documentation terms, these studies have their own entity because they do not only describe how the software is built, but also how the project relates to external obligations that affect its lawful development, distribution, use, and maintenance.

The present section therefore examines, in a structured and non-exhaustive manner, the following areas:
- Data protection and information security legislation.
- Intellectual and industrial property legislation.
- Occupational risk prevention considerations.
- Environmental impact considerations.

---

## 7.2 Study on Data Protection and Information Security Legislation

### 7.2.1 Regulatory Context

Tessellum is a local-first desktop application that stores the user's knowledge base primarily as Markdown files located in a folder chosen by the user. Because notes may contain personal data, academic material, professional information, or other sensitive content, the project must be assessed in light of applicable data protection principles.

The main legal reference framework for this study is the European data protection regime, especially the General Data Protection Regulation (GDPR), together with the complementary Spanish data protection framework where applicable.

### 7.2.2 Project Impact

From a functional perspective, Tessellum reduces data protection exposure because it does not require a cloud backend for its normal operation. The application is designed so that:
- User data remains on local storage under the user's control.
- Search indexes, graph projections, caches, and derived metadata are generated locally.
- The application does not need to transmit note contents to external servers for ordinary use.

This architecture supports the principles of data minimization and limited disclosure because the system avoids unnecessary remote processing of personal information.

### 7.2.3 Main Compliance Considerations

Even with a local-first architecture, compliance obligations remain relevant:
- Users or deploying organizations must ensure that the data stored in Tessellum has a lawful basis for processing.
- If the application is used in institutional or corporate environments, the organization remains responsible for defining retention, access control, backup, and incident-management policies.
- Exported files, copied vaults, and local backups may contain personal data and must be protected accordingly.
- Any future feature involving synchronization, telemetry, online collaboration, or external AI services would require a specific additional legal review.

### 7.2.4 Assessment

In its current architecture, Tessellum is favorable from a data protection standpoint because it follows a privacy-by-design approach based on local execution, limited data exposure, and the absence of mandatory centralized storage. However, lawful use still depends on the nature of the stored content and on the organizational context in which the software is deployed.

---

## 7.3 Study on Intellectual and Industrial Property Legislation

### 7.3.1 Intellectual Property of the Software

The Tessellum codebase, documentation, interface assets, and original technical materials constitute intellectual creations protected by copyright. The project must therefore clearly identify authorship, ownership, and the licensing conditions under which the software can be studied, modified, distributed, or reused.

This study must also consider third-party dependencies incorporated into the project, since the final application is built on top of external libraries, frameworks, icons, fonts, and development tools.

### 7.3.2 Third-Party Components and License Compatibility

The project integrates open-source dependencies from the Rust and Node.js ecosystems. As a result, legal compliance requires:
- Preserving the license notices required by third-party packages.
- Verifying that dependency licenses are compatible with the intended academic, private, or distributable use of the application.
- Avoiding the incorporation of assets, code fragments, or media whose origin and license are unknown or incompatible.

### 7.3.3 User Content and Generated Artifacts

Tessellum manages notes, attachments, and exported documents created or imported by the user. Ownership of that content remains separate from ownership of the software itself. Consequently:
- The application does not transfer authorship of user-created notes to the software author.
- The user remains responsible for ensuring that imported texts, images, PDFs, and embedded resources do not infringe third-party rights.
- Exported outputs generated by the application may include protected user material and must be handled under the corresponding legal conditions.

### 7.3.4 Industrial Property Considerations

Although Tessellum is primarily a software engineering project rather than an industrial design product, industrial property issues may still arise in relation to trademarks, trade names, logos, or distinctive signs associated with the application. The project should therefore avoid:
- Using names or visual identifiers that conflict with existing protected marks.
- Reusing brand assets from third parties without authorization.

### 7.3.5 Assessment

The project is legally viable in intellectual and industrial property terms provided that authorship is documented, third-party licenses are respected, and the origin of external assets is controlled. The main legal risk does not derive from the internal architecture of the application, but from improper reuse of software components or user-imported protected content.

---

## 7.4 Study on Occupational Risk Prevention

### 7.4.1 Nature of the Project

Tessellum is a software product developed mainly through computer-based engineering activities, including programming, testing, documentation, and interface validation. It does not involve heavy machinery, chemical agents, or hazardous industrial manufacturing processes. Therefore, the associated occupational risks are predominantly ergonomic, visual, and organizational.

### 7.4.2 Main Risk Factors

The most relevant occupational risk prevention factors in the development and maintenance of the project are:
- Prolonged screen exposure.
- Poor workstation ergonomics.
- Repetitive strain associated with keyboard and mouse use.
- Mental fatigue linked to sustained debugging, testing, and analytical work.
- Electrical and general office safety conditions in the workplace.

### 7.4.3 Preventive Measures

The recommended preventive measures for project execution are the standard ones applicable to software engineering environments:
- Use of ergonomically appropriate desks, chairs, and screen positions.
- Periodic breaks to reduce eye strain and musculoskeletal overload.
- Adequate lighting, ventilation, and noise conditions.
- Safe organization of cables, devices, and electrical connections.
- Reasonable workload planning to reduce stress peaks during development and delivery stages.

### 7.4.4 Assessment

No extraordinary occupational hazards are identified for the normal development of Tessellum. The project fits within conventional office and academic software-development conditions, so risk prevention should be handled through standard workstation safety and ergonomic best practices.

---

## 7.5 Study on Environmental Impact

### 7.5.1 General Considerations

The environmental impact of Tessellum is low when compared with projects requiring dedicated servers, physical manufacturing, or continuous cloud infrastructure. Its local-first architecture reduces dependence on permanent remote services and lowers the operational footprint associated with data-center processing.

### 7.5.2 Main Environmental Factors

The relevant environmental factors associated with the project are:
- Electrical consumption of the development and execution devices.
- Indirect energy consumption derived from compilation, automated testing, and local indexing tasks.
- Storage occupation on local disks and backup media.
- Potential electronic waste associated with the lifecycle of the hardware used to develop and run the software.

### 7.5.3 Favorable Characteristics of the Project

Several design decisions reduce the environmental footprint of the project:
- The application works without requiring a permanent cloud backend.
- User information is stored as lightweight Markdown files rather than in heavy proprietary formats.
- The architecture favors local processing and avoids unnecessary network transfers during normal use.
- The software can prolong the useful value of general-purpose personal computers by providing advanced knowledge-management capabilities without specialized hardware.

### 7.5.4 Assessment

The environmental impact of Tessellum is limited and acceptable for a project of its type. Its main impact is indirect and derives from ordinary electricity use and computing hardware consumption. No significant adverse environmental effects are identified beyond those normally associated with software development and desktop application usage.

---

## 7.6 Final Synthesis

The studies presented in this section justify the external legal and operational adequacy of the Tessellum project in areas that are complementary to purely technical design and implementation.

From the perspective of UNE 157801 compliance, the project shows a favorable profile:
- In data protection terms, the local-first architecture reduces unnecessary exposure of personal information.
- In intellectual and industrial property terms, compliance depends on correct authorship attribution, license management, and controlled use of third-party materials.
- In occupational risk prevention terms, the project falls within standard software engineering working conditions.
- In environmental terms, the impact is low and mainly associated with ordinary computing resource consumption.

Consequently, no blocking legal or operational factor has been identified that would prevent the development, academic presentation, or ordinary use of Tessellum, provided that the stated compliance conditions are respected.
