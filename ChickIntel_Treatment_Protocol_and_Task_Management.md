# ChickIntel Treatment Protocol and Task Management

## 1. Purpose

The Treatment Protocol feature will provide a reusable treatment and monitoring workflow for each supported chicken disease.

Each disease will have its own Treatment Protocol. The protocol contains tasks assigned to specific days.

When a chicken is diagnosed with a disease, ChickIntel creates a new Treatment Case using the disease's protocol. The protocol stays reusable, while the treatment history belongs to the specific chicken.

## 2. Supported Diseases

The initial protocols will cover:

- Infectious Coryza
- Fowlpox
- CRD
- Bumblefoot

## 3. Core Concept

The system will use four related concepts:

### Disease Protocol
A reusable template for a specific disease.

Example:

Coryza Protocol
- Day 1 tasks
- Day 2 tasks
- Day 3 tasks
- Day 4 tasks
- Day 5 tasks
- Day 6 tasks
- Day 7 tasks

### Treatment Case
A treatment record created for one specific chicken after diagnosis.

Example:

Chicken #001
- Disease: Infectious Coryza
- Protocol: Coryza Protocol
- Start Date: September 20
- Status: Active

### Treatment Task
An individual action that the farmer needs to perform.

Example:

- Check respiratory symptoms
- Check appetite
- Record observation
- Complete prescribed treatment, if applicable

### Task History
A record of completed or skipped tasks, including notes and completion dates.

## 4. Daily Task Workflow

Each disease can have different tasks and different durations.

### Infectious Coryza

#### Day 1
- Isolate affected chicken.
- Check breathing and nasal discharge.
- Check appetite and water intake.
- Record initial condition.
- Record veterinarian-prescribed treatment, if applicable.

#### Day 2
- Check respiratory symptoms.
- Check appetite and water intake.
- Record progress.
- Complete prescribed treatment according to recorded veterinary instructions, if applicable.

#### Day 3
- Check respiratory symptoms.
- Check activity.
- Check food and water intake.
- Record progress.

#### Day 4 to Day 6
- Continue daily symptom monitoring.
- Continue prescribed treatment according to veterinary instructions, if applicable.
- Record changes in condition.

#### Day 7
- Perform follow-up assessment.
- Record treatment response.
- Set case outcome.

Possible outcomes:
- Improving
- Recovered
- Persistent
- Requires Veterinary Attention

## 5. Fowlpox

Fowlpox is viral, so the default protocol should focus on supportive care, monitoring, isolation, and prevention of secondary problems.

#### Day 1
- Isolate affected chicken.
- Inspect skin lesions.
- Check mouth and throat for lesions.
- Check appetite, drinking, activity, and breathing.
- Record initial condition.

#### Day 2 to Day 7
- Monitor lesion condition.
- Check for new lesions.
- Monitor appetite and water intake.
- Maintain a clean and dry environment.
- Record changes in condition.

#### Follow-up
- Record whether lesions are improving, unchanged, or worsening.
- Check for possible spread to other chickens.
- Record final outcome.

## 6. CRD

For ChickIntel, CRD can be represented as Chronic Respiratory Disease associated with Mycoplasma infection.

#### Day 1
- Isolate affected chicken.
- Check coughing, sneezing, nasal discharge, eye discharge, and breathing.
- Check appetite and water intake.
- Check environmental conditions such as ventilation.
- Record initial symptoms.

#### Day 2 to Day 6
- Monitor respiratory symptoms.
- Check appetite and activity.
- Check eye and nasal discharge.
- Record symptom changes.
- Follow veterinarian-prescribed treatment, if applicable.

#### Day 7
- Perform follow-up respiratory assessment.
- Record response to treatment.
- Check for persistent or recurring symptoms.
- Set case outcome.

## 7. Bumblefoot

Bumblefoot should use a severity-based approach because treatment can differ depending on the condition of the foot.

#### Day 1
- Inspect both feet.
- Check for swelling, redness, wounds, scabs, or discharge.
- Check walking ability.
- Identify affected foot.
- Record lesion severity.
- Flag severe cases for veterinary attention.

#### Day 2 to Day 6
- Check the affected foot.
- Monitor swelling and wound condition.
- Check walking ability.
- Keep the environment clean and dry.
- Apply veterinarian-approved care when applicable.
- Record observations.

#### Day 7
- Perform follow-up assessment.
- Compare the foot condition with the initial assessment.
- Record recovery status.
- Flag persistent or worsening cases for veterinary attention.

## 8. Task Status

Each treatment task should support these statuses:

- Pending
- In Progress
- Completed
- Skipped
- Overdue
- Requires Veterinary Attention

## 9. Treatment Case Status

Each treatment case should support:

- Active
- Improving
- Recovered
- Persistent
- Recurring
- Requires Veterinary Attention
- Deceased

## 10. Notes and Evidence

Tasks should support additional information when needed.

Possible fields:

- Note
- Photo
- Completed date
- Completed by
- Observation
- Treatment response

Not every task needs a photo or note. The protocol should define whether a task requires them.

## 11. Reusable Protocol Example

The protocol should work like a template.

Example:

Coryza Protocol
→ Day 1 tasks
→ Day 2 tasks
→ Day 3 tasks
→ Day 4 tasks
→ Day 5 tasks
→ Day 6 tasks
→ Day 7 tasks

When Chicken #001 gets Coryza:

Coryza Protocol
→ Creates Treatment Case for Chicken #001
→ Creates Day 1 to Day 7 tasks
→ Farmer completes tasks
→ System saves task history

Later, when Chicken #025 gets Coryza:

Coryza Protocol
→ Creates a new Treatment Case for Chicken #025
→ Creates a fresh set of tasks
→ Chicken #025 gets its own treatment history

The original protocol remains unchanged.

## 12. Recommended Database Structure

### treatment_protocols

- id
- disease_id
- protocol_name
- description
- active
- created_at
- updated_at

### treatment_protocol_tasks

- id
- protocol_id
- task_name
- description
- task_type
- day_offset
- duration_days
- requires_note
- requires_photo
- requires_vet
- sort_order

### treatment_cases

- id
- chicken_id
- disease_id
- protocol_id
- started_at
- expected_end_date
- status
- outcome
- created_at
- updated_at

### treatment_tasks

- id
- treatment_case_id
- protocol_task_id
- due_at
- status
- completed_at
- completed_by
- note
- photo_url

## 13. Important Design Rule

The disease protocol should be reusable, but the actual treatment case must belong to the individual chicken.

This prevents one chicken's task history from affecting another chicken.

Protocol:
Reusable template.

Treatment Case:
Specific chicken and disease episode.

Treatment Task:
Specific action for that treatment case.

Task History:
Record of what actually happened.

## 14. Health Monitoring Integration

The workflow should connect with the existing Health Monitoring module:

Disease Detection
→ Health Result
→ Create Treatment Case
→ Load Disease Treatment Protocol
→ Generate Daily Tasks
→ Farmer Completes Tasks
→ Save Notes and Evidence
→ Monitor Progress
→ Follow-up Assessment
→ Treatment Outcome

## 15. Important Medication Rule

The system should not automatically prescribe a specific medication, dose, or duration as a universal instruction.

Medication-related tasks should allow veterinarian-prescribed information to be recorded.

Suggested fields:

- Medication name
- Dose
- Frequency
- Start date
- End date
- Prescribed by
- Treatment note

This keeps the protocol reusable while allowing the actual treatment instructions to be recorded for the individual case.

## 16. Recommended UI

### Treatment Protocol View

Show:

- Disease name
- Protocol name
- Description
- Total treatment days
- Daily task list

Example:

Infectious Coryza
7-Day Treatment and Monitoring Protocol

Day 1
- Isolate chicken
- Check respiratory symptoms
- Check appetite
- Record initial condition

Day 2
- Check respiratory symptoms
- Check appetite
- Record progress

### Active Treatment Case

Show:

Chicken #001
Infectious Coryza
Day 3 of 7

Today's Tasks
- [ ] Check respiratory symptoms
- [ ] Check appetite and water intake
- [ ] Record observation

Previous Tasks
- Completed Day 1
- Completed Day 2

Treatment Progress
- 4 of 7 days completed

## 17. Final System Structure

The final feature should follow this structure:

Disease
→ Treatment Protocol
→ Daily Tasks
→ Treatment Case
→ Individual Chicken
→ Task Completion
→ Notes and Evidence
→ Follow-up
→ Outcome

This approach makes the Treatment Protocol a reusable system feature instead of a static list of recommendations.
